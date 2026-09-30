import os
import re
import json
import math
import uuid
import base64
import asyncio
import sqlite3
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from typing import Optional

import requests
from fastapi import FastAPI, Form, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

DB_PATH = "complaints.db"
UPLOAD_DIR = "uploads"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
AI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.6-luna")

os.makedirs(UPLOAD_DIR, exist_ok=True)

def utc_now():
    return datetime.now(timezone.utc)

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id TEXT PRIMARY KEY,
            complaint_text TEXT NOT NULL,
            language TEXT NOT NULL,
            problem TEXT NOT NULL,
            severity TEXT NOT NULL,
            priority TEXT NOT NULL,
            department TEXT NOT NULL,
            keywords TEXT,
            area TEXT,
            address TEXT,
            latitude REAL,
            longitude REAL,
            image_path TEXT,
            status TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            last_action_at TEXT NOT NULL,
            escalated INTEGER NOT NULL DEFAULT 0,
            escalated_at TEXT,
            resolved_at TEXT
        )
    """)
    conn.commit()
    conn.close()

def parse_dt(value):
    return datetime.fromisoformat(value)

def guess_language(text):
    if re.search(r"[\u0900-\u097F]", text):
        return "Hindi"
    if re.search(r"[\u0980-\u09FF]", text):
        return "Bengali"
    if re.search(r"[\u0A80-\u0AFF]", text):
        return "Gujarati"
    if re.search(r"[\u0B80-\u0BFF]", text):
        return "Tamil"
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "Telugu"
    if re.search(r"[\u0D00-\u0D7F]", text):
        return "Malayalam"
    if re.search(r"[\u0600-\u06FF]", text):
        return "Urdu/Arabic"
    return "English/Hinglish"

def save_image(file):
    if not file or not file.filename:
        return None

    if not file.content_type or not file.content_type.startswith("image/"):
        raise ValueError("Only image files are allowed.")

    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    return os.path.join(UPLOAD_DIR, name)

async def store_upload(file):
    path = save_image(file)

    if not path:
        return None

    data = await file.read()

    with open(path, "wb") as f:
        f.write(data)

    return path

def fallback_ai(text):
    t = text.lower()

    rules = [
        (
            ["pothole", "gaddha", "road broken", "road damaged", "sadak toot", "सड़क", "गड्ढा"],
            "Road Damage",
            "Public Works Department"
        ),
        (
            ["drain", "nala", "nali", "sewer", "waterlogging", "paani bhar", "नाला", "नाली", "सीवर", "जलभराव"],
            "Drainage",
            "Water & Sewerage Department"
        ),
        (
            ["garbage", "kachra", "waste", "dustbin", "कचरा", "कूड़ा"],
            "Garbage",
            "Municipal Sanitation Department"
        ),
        (
            ["street light", "road light", "lamp", "light not working", "streetlight", "स्ट्रीट लाइट"],
            "Street Light",
            "Electrical Department"
        ),
        (
            ["water supply", "drinking water", "tap water", "pani nahi", "पानी नहीं"],
            "Water Supply",
            "Water Supply Department"
        ),
        (
            ["traffic", "signal", "jam", "ट्रैफिक", "सिग्नल"],
            "Traffic",
            "Traffic Department"
        ),
        (
            ["footpath", "pavement", "फुटपाथ"],
            "Footpath",
            "Public Works Department"
        )
    ]

    problem = "Other"
    department = "Municipal Corporation"

    for keywords, p, d in rules:
        if any(k in t for k in keywords):
            problem = p
            department = d
            break

    severe_words = [
        "accident",
        "dangerous",
        "flood",
        "fire",
        "electric shock",
        "collapse",
        "injury",
        "खतरा",
        "बाढ़",
        "आग",
        "करंट",
        "गिर",
        "दुर्घटना"
    ]

    high = any(k in t for k in severe_words)

    priority = "High" if high else "Medium"
    severity = "High" if high else "Medium"

    return {
        "language": guess_language(text),
        "problem": problem,
        "severity": severity,
        "priority": priority,
        "department": department,
        "keywords": re.findall(r"[A-Za-z\u0900-\u097F]{3,}", text)[:10],
        "summary": text[:200],
        "confidence": 0.65
    }

def openai_ai(text, image_path=None):
    if not OPENAI_API_KEY or OpenAI is None:
        return fallback_ai(text)

    client = OpenAI(api_key=OPENAI_API_KEY)

    instruction = """
Analyze a citizen complaint for a municipal complaint management system.

Understand multilingual complaints, Hinglish and mixed-language text.

Return only valid JSON.

Fields:
language
problem
severity
priority
department
keywords
summary
confidence

severity must be one of:
Low, Medium, High, Critical

priority must be one of:
Low, Medium, High, Critical

Priority is an administrative suggestion and must not be treated as a final government decision.

Choose the practical municipal department responsible for the issue.

Do not invent a location.

Complaint:
""" + text

    content = [
        {
            "type": "input_text",
            "text": instruction
        }
    ]

    if image_path:
        with open(image_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")

        mime = "image/jpeg"
        ext = os.path.splitext(image_path)[1].lower()

        if ext == ".png":
            mime = "image/png"
        elif ext == ".webp":
            mime = "image/webp"

        content.append({
            "type": "input_image",
            "image_url": f"data:{mime};base64,{encoded}"
        })

    response = client.responses.create(
        model=AI_MODEL,
        input=[
            {
                "role": "user",
                "content": content
            }
        ]
    )

    raw = response.output_text.strip()

    raw = re.sub(r"^```(?:json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()

    try:
        result = json.loads(raw)
    except Exception:
        return fallback_ai(text)

    required = [
        "language",
        "problem",
        "severity",
        "priority",
        "department",
        "keywords",
        "summary",
        "confidence"
    ]

    if not all(k in result for k in required):
        return fallback_ai(text)

    return result

def get_location(lat, lon):
    if lat is None or lon is None:
        return {
            "area": "",
            "address": ""
        }

    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lon,
                "format": "json",
                "zoom": 18,
                "addressdetails": 1
            },
            headers={
                "User-Agent": "CitizenComplaintAI/1.0"
            },
            timeout=10
        )

        data = response.json()
        address = data.get("address", {})

        area = (
            address.get("neighbourhood")
            or address.get("suburb")
            or address.get("town")
            or address.get("city")
            or ""
        )

        return {
            "area": area,
            "address": data.get("display_name", "")
        }

    except Exception:
        return {
            "area": "",
            "address": ""
        }

def distance_km(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return None

    radius = 6371

    p1 = math.radians(lat1)
    p2 = math.radians(lat2)

    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = (
        math.sin(dp / 2) ** 2
        + math.cos(p1)
        * math.cos(p2)
        * math.sin(dl / 2) ** 2
    )

    return radius * 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

def similar_complaints(text, lat=None, lon=None):
    conn = db()

    rows = conn.execute(
        "SELECT * FROM complaints WHERE status != 'Resolved'"
    ).fetchall()

    conn.close()

    if not rows:
        return []

    corpus = [text] + [
        row["complaint_text"]
        for row in rows
    ]

    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        min_df=1
    )

    matrix = vectorizer.fit_transform(corpus)

    scores = cosine_similarity(
        matrix[0:1],
        matrix[1:]
    )[0]

    results = []

    for i, row in enumerate(rows):
        score = float(scores[i])

        distance = distance_km(
            lat,
            lon,
            row["latitude"],
            row["longitude"]
        )

        location_bonus = 0.12 if (
            distance is not None and
            distance <= 1.0
        ) else 0

        final_score = min(
            1.0,
            score + location_bonus
        )

        if final_score >= 0.42:
            results.append({
                "id": row["id"],
                "problem": row["problem"],
                "priority": row["priority"],
                "status": row["status"],
                "similarity": round(
                    final_score * 100,
                    1
                ),
                "distance_km": round(
                    distance,
                    2
                ) if distance is not None else None
            })

    results.sort(
        key=lambda x: x["similarity"],
        reverse=True
    )

    return results[:5]

def make_id():
    return (
        "CMP-"
        + utc_now().strftime("%Y%m%d")
        + "-"
        + uuid.uuid4().hex[:6].upper()
    )

def create_complaint(data):
    complaint_id = make_id()

    now = utc_now()

    conn = db()

    conn.execute(
        """
        INSERT INTO complaints
        (
            id,
            complaint_text,
            language,
            problem,
            severity,
            priority,
            department,
            keywords,
            area,
            address,
            latitude,
            longitude,
            image_path,
            status,
            submitted_at,
            last_action_at,
            escalated,
            escalated_at,
            resolved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)
        """,
        (
            complaint_id,
            data["complaint_text"],
            data["language"],
            data["problem"],
            data["severity"],
            data["priority"],
            data["department"],
            json.dumps(
                data.get("keywords", []),
                ensure_ascii=False
            ),
            data.get("area", ""),
            data.get("address", ""),
            data.get("latitude"),
            data.get("longitude"),
            data.get("image_path"),
            "Submitted",
            now.isoformat(),
            now.isoformat()
        )
    )

    conn.commit()
    conn.close()

    return complaint_id

def serialize(row):
    now = utc_now()

    deadline = (
        parse_dt(row["last_action_at"])
        + timedelta(hours=48)
    )

    remaining = max(
        0,
        int(
            (
                deadline - now
            ).total_seconds()
        )
    )

    hours = remaining // 3600
    minutes = (remaining % 3600) // 60

    return {
        "id": row["id"],
        "complaint": row["complaint_text"],
        "language": row["language"],
        "problem": row["problem"],
        "severity": row["severity"],
        "priority": row["priority"],
        "department": row["department"],
        "area": row["area"],
        "address": row["address"],
        "status": row["status"],
        "submitted_at": row["submitted_at"],
        "last_action_at": row["last_action_at"],
        "hours_remaining": hours,
        "minutes_remaining": minutes,
        "escalated": bool(row["escalated"]),
        "resolved_at": row["resolved_at"]
    }

async def check_and_escalate():
    while True:
        try:
            conn = db()

            rows = conn.execute(
                """
                SELECT *
                FROM complaints
                WHERE status != 'Resolved'
                AND escalated = 0
                """
            ).fetchall()

            now = utc_now()

            for row in rows:
                last_action = parse_dt(
                    row["last_action_at"]
                )

                if now - last_action >= timedelta(hours=48):
                    conn.execute(
                        """
                        UPDATE complaints
                        SET
                            escalated = 1,
                            escalated_at = ?,
                            status = 'Escalated to HOD'
                        WHERE id = ?
                        """,
                        (
                            now.isoformat(),
                            row["id"]
                        )
                    )

            conn.commit()
            conn.close()

        except Exception:
            pass

        await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app):
    init_db()

    task = asyncio.create_task(
        check_and_escalate()
    )

    yield

    task.cancel()

    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Citizen Complaint AI",
    lifespan=lifespan
)

HTML = """
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Citizen Complaint AI</title>
<style>
body{
font-family:Arial,sans-serif;
background:#f4f7fb;
margin:0;
color:#152238
}
.wrap{
max-width:920px;
margin:35px auto;
padding:20px
}
.card{
background:#fff;
padding:24px;
border-radius:18px;
box-shadow:0 8px 25px rgba(0,0,0,.08);
margin-bottom:20px
}
h1{
margin-top:0
}
textarea,input{
width:100%;
box-sizing:border-box;
padding:13px;
margin:8px 0 14px;
border:1px solid #d5dbe5;
border-radius:10px
}
button{
padding:12px 18px;
border:0;
border-radius:10px;
cursor:pointer;
margin-right:8px
}
.primary{
background:#1f6feb;
color:white
}
.secondary{
background:#e9eef7
}
.result{
background:#f7f9fc;
padding:16px;
border-radius:12px;
margin-top:16px
}
.hidden{
display:none
}
.grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:14px
}
.badge{
display:inline-block;
padding:6px 10px;
border-radius:999px;
background:#e9eef7;
margin:3px
}
@media(max-width:700px){
.grid{
grid-template-columns:1fr
}
}
</style>
</head>
<body>

<div class="wrap">

<div class="card">

<h1>🏛️ Citizen Complaint AI</h1>

<p>
Apni complaint likhiye. AI problem, priority,
department aur similar complaints check karega.
</p>

<textarea
id="complaint"
rows="6"
placeholder="Example: Hamare area mein 3 din se nala overflow ho raha hai..."
></textarea>

<input
id="photo"
type="file"
accept="image/*"
>

<div class="grid">

<input
id="lat"
type="number"
step="any"
placeholder="Latitude"
>

<input
id="lon"
type="number"
step="any"
placeholder="Longitude"
>

</div>

<button
class="secondary"
onclick="getLocation()"
>
📍 Use My Location
</button>

<button
class="primary"
onclick="analyze()"
>
🤖 Analyze Complaint
</button>

<div
id="analysis"
class="result hidden"
></div>

<button
id="submitBtn"
class="primary hidden"
onclick="submitComplaint()"
>
✅ Confirm & Submit
</button>

</div>

<div class="card">

<h2>🔎 Track Complaint</h2>

<input
id="trackId"
placeholder="CMP-20260922-XXXXXX"
>

<button
class="primary"
onclick="track()"
>
Track
</button>

<div
id="tracking"
class="result hidden"
></div>

</div>

</div>

<script>

let lastAnalysis = null;

function getLocation(){

    if(!navigator.geolocation){
        alert("Browser location support nahi karta.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        p => {

            document.getElementById("lat").value =
                p.coords.latitude;

            document.getElementById("lon").value =
                p.coords.longitude;

            alert("Location add ho gayi.");

        },
        () => {
            alert("Location permission allow karo.");
        }
    );
}

async function analyze(){

    const text =
        document.getElementById("complaint")
        .value
        .trim();

    if(!text){
        alert("Complaint likho.");
        return;
    }

    const fd = new FormData();

    fd.append("complaint", text);

    fd.append(
        "latitude",
        document.getElementById("lat").value
    );

    fd.append(
        "longitude",
        document.getElementById("lon").value
    );

    const photo =
        document.getElementById("photo")
        .files[0];

    if(photo){
        fd.append("file", photo);
    }

    const response = await fetch(
        "/api/analyze",
        {
            method:"POST",
            body:fd
        }
    );

    const data = await response.json();

    if(!response.ok){
        alert(
            data.detail ||
            "Analysis failed"
        );
        return;
    }

    lastAnalysis = data;

    let similar = "";

    if(data.similar.length){

        similar =
            "<h3>🔎 Similar Complaints</h3>" +
            data.similar
            .map(
                x =>
                `<div class="badge">
                ${x.id} ·
                ${x.similarity}% ·
                ${x.status}
                </div>`
            )
            .join("");

    }else{

        similar =
            "<p>✅ Koi strong similar complaint nahi mili.</p>";

    }

    document.getElementById(
        "analysis"
    ).innerHTML =

        `<b>Language:</b>
        ${data.ai.language}<br>

        <b>Problem:</b>
        ${data.ai.problem}<br>

        <b>Severity:</b>
        ${data.ai.severity}<br>

        <b>Priority:</b>
        ${data.ai.priority}<br>

        <b>Department:</b>
        ${data.ai.department}<br>

        <b>Summary:</b>
        ${data.ai.summary}<br>

        <b>Area:</b>
        ${data.location.area || "Not available"}
        <br>

        ${similar}`;

    document.getElementById(
        "analysis"
    ).classList.remove("hidden");

    document.getElementById(
        "submitBtn"
    ).classList.remove("hidden");
}

async function submitComplaint(){

    if(!lastAnalysis){
        return;
    }

    if(lastAnalysis.similar.length){

        const ok = confirm(
            "Similar complaints mili hain. " +
            "Phir bhi complaint submit karni hai?"
        );

        if(!ok){
            return;
        }
    }

    const response = await fetch(
        "/api/submit",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify(
                lastAnalysis
            )
        }
    );

    const data =
        await response.json();

    if(!response.ok){

        alert(
            data.detail ||
            "Submit failed"
        );

        return;
    }

    alert(
        "Complaint registered. ID: "
        + data.id
    );

    document.getElementById(
        "trackId"
    ).value = data.id;

    track();
}

async function track(){

    const id =
        document.getElementById(
            "trackId"
        ).value
        .trim();

    if(!id){
        alert("Complaint ID enter karo.");
        return;
    }

    const response =
        await fetch(
            "/api/complaints/" +
            encodeURIComponent(id)
        );

    const data =
        await response.json();

    if(!response.ok){

        alert(
            data.detail ||
            "Complaint not found"
        );

        return;
    }

    document.getElementById(
        "tracking"
    ).innerHTML =

        `<b>Complaint ID:</b>
        ${data.id}<br>

        <b>Problem:</b>
        ${data.problem}<br>

        <b>Priority:</b>
        ${data.priority}<br>

        <b>Department:</b>
        ${data.department}<br>

        <b>Status:</b>
        ${data.status}<br>

        <b>Submitted:</b>
        ${new Date(
            data.submitted_at
        ).toLocaleString()}<br>

        <b>48h action timer:</b>
        ${
            data.escalated
            ? "Escalated to HOD"
            : data.hours_remaining +
              "h " +
              data.minutes_remaining +
              "m remaining"
        }`;

    document.getElementById(
        "tracking"
    ).classList.remove("hidden");
}

</script>

</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
def home():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/api/analyze")
async def analyze_api(
    complaint: str = Form(...),
    latitude: str = Form(""),
    longitude: str = Form(""),
    file: Optional[UploadFile] = File(None)
):

    complaint = complaint.strip()

    if len(complaint) < 5:

        return JSONResponse(
            {
                "detail":
                "Complaint thodi detail mein likho."
            },
            status_code=400
        )

    lat = (
        float(latitude)
        if latitude.strip()
        else None
    )

    lon = (
        float(longitude)
        if longitude.strip()
        else None
    )

    image_path = (
        await store_upload(file)
        if file
        else None
    )

    ai = openai_ai(
        complaint,
        image_path
    )

    location = get_location(
        lat,
        lon
    )

    similar = similar_complaints(
        complaint,
        lat,
        lon
    )

    return {
        "complaint_text": complaint,
        "ai": ai,
        "location": location,
        "latitude": lat,
        "longitude": lon,
        "image_path": image_path,
        "similar": similar
    }

@app.post("/api/submit")
async def submit_api(
    payload: dict
):

    required = [
        "complaint_text",
        "ai",
        "location"
    ]

    if not all(
        key in payload
        for key in required
    ):

        return JSONResponse(
            {
                "detail":
                "Invalid submission."
            },
            status_code=400
        )

    ai = payload["ai"]

    complaint_id = create_complaint(
        {
            "complaint_text":
                payload["complaint_text"],

            "language":
                ai.get(
                    "language",
                    "Unknown"
                ),

            "problem":
                ai.get(
                    "problem",
                    "Other"
                ),

            "severity":
                ai.get(
                    "severity",
                    "Medium"
                ),

            "priority":
                ai.get(
                    "priority",
                    "Medium"
                ),

            "department":
                ai.get(
                    "department",
                    "Municipal Corporation"
                ),

            "keywords":
                ai.get(
                    "keywords",
                    []
                ),

            "area":
                payload
                .get("location", {})
                .get("area", ""),

            "address":
                payload
                .get("location", {})
                .get("address", ""),

            "latitude":
                payload.get(
                    "latitude"
                ),

            "longitude":
                payload.get(
                    "longitude"
                ),

            "image_path":
                payload.get(
                    "image_path"
                )
        }
    )

    return {
        "ok": True,
        "id": complaint_id
    }

@app.get(
    "/api/complaints/{complaint_id}"
)
def get_complaint(
    complaint_id: str
):

    conn = db()

    row = conn.execute(
        "SELECT * FROM complaints WHERE id = ?",
        (complaint_id.upper(),)
    ).fetchone()

    conn.close()

    if not row:

        return JSONResponse(
            {
                "detail":
                "Complaint ID nahi mili."
            },
            status_code=404
        )

    return serialize(row)

@app.get(
    "/api/complaints"
)
def list_complaints():

    conn = db()

    rows = conn.execute(
        """
        SELECT *
        FROM complaints
        ORDER BY submitted_at DESC
        """
    ).fetchall()

    conn.close()

    return [
        serialize(row)
        for row in rows
    ]

@app.post(
    "/api/complaints/{complaint_id}/status"
)
def update_status(
    complaint_id: str,
    status: str
):

    allowed = {
        "Submitted",
        "In Progress",
        "Resolved"
    }

    status = status.strip()

    if status not in allowed:

        return JSONResponse(
            {
                "detail":
                "Invalid status."
            },
            status_code=400
        )

    now = utc_now()

    conn = db()

    row = conn.execute(
        """
        SELECT *
        FROM complaints
        WHERE id = ?
        """,
        (complaint_id.upper(),)
    ).fetchone()

    if not row:

        conn.close()

        return JSONResponse(
            {
                "detail":
                "Complaint not found."
            },
            status_code=404
        )

    resolved_at = (
        now.isoformat()
        if status == "Resolved"
        else None
    )

    conn.execute(
        """
        UPDATE complaints
        SET
            status = ?,
            last_action_at = ?,
            escalated = 0,
            escalated_at = NULL,
            resolved_at = ?
        WHERE id = ?
        """,
        (
            status,
            now.isoformat(),
            resolved_at,
            complaint_id.upper()
        )
    )

    conn.commit()
    conn.close()

    return {
        "ok": True
    }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )