const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const app = express();
const PORT = 5000;
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;
const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

app.use(cors());
app.use(express.json());

app.post("/api/ai/chat", async (req, res) => {
    const question = String(req.body.question || "").trim();
    if (!question) return res.status(400).json({ message: "Question is required" });
    if (!openai) return res.status(503).json({ message: "OpenAI is not configured yet" });

    try {
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are GrievanceAI assistant. Answer clearly in the user's language. Help with civic complaints, ticket tracking, departments, priority, ETA, and using this app. Keep answers concise." },
                { role: "user", content: question }
            ],
            max_tokens: 300
        });
        return res.json({ success: true, answer: completion.choices[0].message.content });
    } catch (error) {
        console.error("OpenAI error:", error.message);
        return res.status(502).json({ message: "AI is temporarily unavailable" });
    }
});

app.post("/api/auth/signup", async (req, res) => {
    const { email, password } = req.body;

    if (!supabase) {
        return res.status(503).json({ message: "Supabase is not configured" });
    }

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: "Email and a password of at least 6 characters are required" });
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ message: error.message });
    return res.json({ success: true, user: data.user, session: data.session });
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!supabase) {
        return res.status(503).json({ message: "Supabase is not configured" });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ message: error.message });
    return res.json({ success: true, user: data.user, session: data.session });
});


// ================= DATABASE =================

const db = new sqlite3.Database("./grievance.db");

db.run(`
    CREATE TABLE IF NOT EXISTS grievances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT UNIQUE,
        name TEXT,
        phone TEXT,
        email TEXT,
        complaint TEXT,
        category TEXT,
        priority TEXT,
        department TEXT,
        status TEXT DEFAULT 'Pending',
        eta TEXT,
        created_at TEXT,
        photo_data TEXT,
        latitude REAL,
        longitude REAL
    )
`);

db.run("ALTER TABLE grievances ADD COLUMN address TEXT", () => {});
db.run("ALTER TABLE grievances ADD COLUMN photo_data TEXT", () => {});
db.run("ALTER TABLE grievances ADD COLUMN latitude REAL", () => {});
db.run("ALTER TABLE grievances ADD COLUMN longitude REAL", () => {});


// ================= AI ANALYSIS =================

function analyzeComplaint(complaint) {

    const text = complaint.toLowerCase();

    let category = "Municipal";
    let department = "Municipal Corporation";
    let priority = "Low";

    // Category
    if (
        text.includes("water") ||
        text.includes("pipe") ||
        text.includes("leakage") ||
        text.includes("tap")
    ) {
        category = "Water";
        department = "Water Supply Department";
    }

    else if (
        text.includes("electricity") ||
        text.includes("power") ||
        text.includes("light") ||
        text.includes("transformer")
    ) {
        category = "Electricity";
        department = "Electricity Board";
    }

    else if (
        text.includes("road") ||
        text.includes("pothole") ||
        text.includes("bridge") ||
        text.includes("street")
    ) {
        category = "Roads";
        department = "Public Works Department";
    }

    else if (
        text.includes("hospital") ||
        text.includes("doctor") ||
        text.includes("medicine") ||
        text.includes("ambulance")
    ) {
        category = "Healthcare";
        department = "Health Department";
    }

    else if (
        text.includes("school") ||
        text.includes("college") ||
        text.includes("teacher") ||
        text.includes("exam")
    ) {
        category = "Education";
        department = "Education Department";
    }


    // Priority

    const highWords = [
        "emergency",
        "urgent",
        "danger",
        "accident",
        "fire",
        "critical",
        "life threat"
    ];

    const mediumWords = [
        "serious",
        "blocked",
        "not working",
        "immediately"
    ];

    if (highWords.some(word => text.includes(word))) {
        priority = "High";
    }

    else if (mediumWords.some(word => text.includes(word))) {
        priority = "Medium";
    }


    return {
        category,
        department,
        priority
    };
}


// ================= HOME =================

app.get("/", (req, res) => {

    res.json({
        message: "GrievanceAI Backend is running!",
        status: "Online"
    });

});


// ================= REPORT GRIEVANCE =================

app.post("/api/grievances", (req, res) => {

    const {
        name,
        phone,
        email,
        address,
        latitude,
        longitude,
        photo_data,
        complaint
    } = req.body;


    if (!name || !phone || !email || !address || !complaint) {

        return res.status(400).json({
            message: "Name, phone, email, address and complaint are required"
        });

    }


    // AI analysis
    const ai = analyzeComplaint(complaint);


    // Ticket ID
    const ticketId =
        "GA" +
        Math.floor(100000 + Math.random() * 900000);


    // ETA
    let days = 5;

    if (ai.priority === "High") {
        days = 1;
    }

    else if (ai.priority === "Medium") {
        days = 3;
    }


    const eta = new Date();

    eta.setDate(
        eta.getDate() + days
    );


    const etaDate =
        eta.toISOString().split("T")[0];


    const createdAt =
        new Date().toISOString();


    const sql = `
        INSERT INTO grievances
        (
            ticket_id,
            name,
            phone,
            email,
            address,
            latitude,
            longitude,
            photo_data,
            complaint,
            category,
            priority,
            department,
            status,
            eta,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;


    db.run(
        sql,
        [
            ticketId,
            name || "",
            phone || "",
            email || "",
            address || "",
            latitude || null,
            longitude || null,
            photo_data || "",
            complaint,
            ai.category,
            ai.priority,
            ai.department,
            "Pending",
            etaDate,
            createdAt
        ],

        function (error) {

            if (error) {

                return res.status(500).json({
                    message: error.message
                });

            }


            const response = {

                success: true,

                message:
                    "Grievance submitted successfully",

                ticket_id: ticketId,

                category: ai.category,

                priority: ai.priority,

                department: ai.department,

                status: "Pending",

                eta: etaDate,
                storage: "SQLite"
            };

            if (!supabase) {
                return res.json(response);
            }

            supabase
                .from("grievances")
                .insert({
                    ticket_id: ticketId,
                    name: name || "",
                    phone: phone || "",
                    email: email || "",
                    address: address || "",
                    latitude: latitude || null,
                    longitude: longitude || null,
                    photo_data: photo_data || "",
                    complaint,
                    category: ai.category,
                    priority: ai.priority,
                    department: ai.department,
                    status: "Pending",
                    eta: etaDate,
                    created_at: createdAt
                })
                .then(({ error: supabaseError }) => {
                    if (supabaseError) {
                        console.error("Supabase save failed:", supabaseError.message);
                        return res.status(502).json({
                            message: "Local save succeeded, but Supabase save failed",
                            details: supabaseError.message
                        });
                    }

                    response.storage = "SQLite + Supabase";
                    return res.json(response);
                });

        }
    );

});


// ================= SEARCH GRIEVANCES =================

app.get("/api/search", (req, res) => {
    const query = String(req.query.q || "").trim();

    if (!query) {
        return res.json({ success: true, results: [] });
    }

    const pattern = `%${query}%`;
    db.all(
        `
        SELECT ticket_id, name, phone, email, address, complaint,
               category, priority, department, status, eta, created_at
        FROM grievances
        WHERE ticket_id LIKE ?
           OR name LIKE ?
           OR phone LIKE ?
           OR email LIKE ?
           OR address LIKE ?
           OR complaint LIKE ?
           OR category LIKE ?
           OR department LIKE ?
        ORDER BY id DESC
        LIMIT 20
        `,
        Array(8).fill(pattern),
        (error, rows) => {
            if (error) return res.status(500).json({ message: error.message });
            return res.json({ success: true, results: rows });
        }
    );
});


// ================= TRACK COMPLAINT =================

app.get("/api/grievances/:ticketId", (req, res) => {

    const ticketId = req.params.ticketId;


    db.get(
        `
        SELECT *
        FROM grievances
        WHERE ticket_id = ?
        `,
        [ticketId],

        (error, row) => {

            if (error) {

                return res.status(500).json({
                    message: error.message
                });

            }


            if (!row) {

                return res.status(404).json({
                    message: "Ticket not found"
                });

            }


            res.json({
                success: true,
                grievance: row
            });

        }
    );

});


// ================= RECENT UPDATES =================

app.get("/api/recent", (req, res) => {

    db.all(
        `
        SELECT
            ticket_id,
            category,
            status,
            created_at
        FROM grievances
        ORDER BY id DESC
        LIMIT 5
        `,

        [],

        (error, rows) => {

            if (error) {

                return res.status(500).json({
                    message: error.message
                });

            }


            res.json({
                success: true,
                updates: rows
            });

        }
    );

});


// ================= DASHBOARD =================

app.get("/api/dashboard", (req, res) => {

    const queries = {

        total: `
            SELECT COUNT(*) AS count
            FROM grievances
        `,

        resolved: `
            SELECT COUNT(*) AS count
            FROM grievances
            WHERE status = 'Resolved'
        `,

        pending: `
            SELECT COUNT(*) AS count
            FROM grievances
            WHERE status = 'Pending'
        `,

        progress: `
            SELECT COUNT(*) AS count
            FROM grievances
            WHERE status = 'In Progress'
        `

    };


    db.get(queries.total, [], (e, total) => {

        db.get(
            queries.resolved,
            [],
            (e, resolved) => {

                db.get(
                    queries.pending,
                    [],
                    (e, pending) => {

                        db.get(
                            queries.progress,
                            [],
                            (e, progress) => {

                                const successRate =
                                    total.count === 0
                                        ? 0
                                        : Math.round(
                                            (resolved.count /
                                                total.count) * 100
                                        );


                                res.json({

                                    total: total.count,

                                    resolved:
                                        resolved.count,

                                    pending:
                                        pending.count,

                                    in_progress:
                                        progress.count,

                                    success_rate:
                                        successRate

                                });

                            }
                        );

                    }
                );

            }
        );

    });

});


// ================= UPDATE STATUS =================

app.patch(
    "/api/grievances/:ticketId",
    (req, res) => {

        const ticketId =
            req.params.ticketId;

        const { status } = req.body;


        db.run(
            `
            UPDATE grievances
            SET status = ?
            WHERE ticket_id = ?
            `,
            [
                status,
                ticketId
            ],

            function (error) {

                if (error) {

                    return res.status(500).json({
                        message: error.message
                    });

                }


                if (this.changes === 0) {

                    return res.status(404).json({
                        message: "Ticket not found"
                    });

                }


                res.json({

                    success: true,

                    message:
                        "Status updated successfully"

                });

            }
        );

    }
);


// ================= SERVER =================

app.listen(PORT, () => {

    console.log(
        `🚀 GrievanceAI running at http://localhost:${PORT}`
    );

});