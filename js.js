// =====================================================
// GRIEVANCE AI - SUPABASE BACKEND
// =====================================================

// ================= SUPABASE CONFIG ====================

// YAHAN APNI SUPABASE VALUES PASTE KARNA
const SUPABASE_URL = "https://wtugrljkepruvtlhntub.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qgs7Q9iIFTg5sn1Oq3jUXQ_KwcE0HzN";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let capturedPhotoData = "";
let cameraStream = null;

window.userLatitude = null;
window.userLongitude = null;


// =====================================================
// SUPABASE CONNECTION TEST
// =====================================================

async function testSupabase() {

    try {

        const { error } = await supabaseClient
            .from("complaints")
            .select("id")
            .limit(1);

        if (error) {
            console.error("Supabase error:", error);
            return;
        }

        console.log("✅ Supabase connected successfully");

    } catch (error) {

        console.error("Supabase connection failed:", error);

    }

}

testSupabase();


// =====================================================
// AI CHAT
// =====================================================

function toggleAiChat() {

    const chat = document.getElementById("aiChat");

    if (!chat) return;

    chat.hidden = !chat.hidden;

    if (!chat.hidden) {
        document.getElementById("aiQuestion")?.focus();
    }
}


const aiForm = document.getElementById("aiForm");

if (aiForm) {

    aiForm.addEventListener("submit", function (event) {

        event.preventDefault();

        const input =
            document.getElementById("aiQuestion");

        const messages =
            document.getElementById("aiMessages");

        const question =
            input.value.trim();

        if (!question) return;


        messages.insertAdjacentHTML(
            "beforeend",
            `<p><b>You:</b> ${escapeHtml(question)}</p>`
        );


        const analysis =
            analyzeComplaint(question);


        messages.insertAdjacentHTML(
            "beforeend",
            `
            <p>
                <b>GrievanceAI:</b>
                This appears to be a
                <strong>${analysis.category}</strong>
                complaint with
                <strong>${analysis.priority}</strong>
                priority.
                Department:
                <strong>${analysis.department}</strong>.
            </p>
            `
        );


        input.value = "";

        messages.scrollTop =
            messages.scrollHeight;

    });

}


// =====================================================
// LOGIN / SIGNUP
// =====================================================

let authMode = "login";


function openAuth(mode) {

    authMode = mode;

    const modal =
        document.getElementById("authModal");

    if (!modal) return;

    modal.hidden = false;
    modal.style.display = "grid";


    document.getElementById("authTitle").textContent =
        mode === "login"
            ? "Login"
            : "Create Account";


    document.getElementById("authSubmit").textContent =
        mode === "login"
            ? "Login"
            : "Sign Up";


    document.getElementById("authMessage").textContent = "";

}


function closeAuth() {

    const modal =
        document.getElementById("authModal");

    if (!modal) return;

    modal.hidden = true;
    modal.style.display = "none";

}


const authForm =
    document.getElementById("authForm");


if (authForm) {

    authForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                document.getElementById("authEmail")
                    .value.trim();

            const password =
                document.getElementById("authPassword")
                    .value;

            const message =
                document.getElementById("authMessage");

            const submit =
                document.getElementById("authSubmit");


            submit.disabled = true;

            message.textContent =
                "Please wait...";


            try {

                // ================= SIGNUP =================

                if (authMode === "signup") {

                    const {
                        data,
                        error
                    } =
                        await supabaseClient.auth.signUp({
                            email: email,
                            password: password
                        });


                    if (error) {
                        throw error;
                    }


                    if (data.session) {

                        message.textContent =
                            "Account created successfully.";

                        setTimeout(
                            closeAuth,
                            800
                        );

                    } else {

                        message.textContent =
                            "Account created. Please check your email for verification.";

                    }

                }

                // ================= LOGIN =================

                else {

                    const {
                        data,
                        error
                    } =
                        await supabaseClient.auth
                            .signInWithPassword({
                                email: email,
                                password: password
                            });


                    if (error) {
                        throw error;
                    }


                    localStorage.setItem(
                        "grievance_user",
                        JSON.stringify(data.user)
                    );


                    message.textContent =
                        "Login successful.";

                    setTimeout(
                        closeAuth,
                        800
                    );

                }


            } catch (error) {

                console.error(error);

                message.textContent =
                    error.message ||
                    "Authentication failed.";

            }


            submit.disabled = false;

        }
    );

}


// =====================================================
// LOGOUT
// =====================================================

async function logoutUser() {

    const {
        error
    } =
        await supabaseClient.auth.signOut();


    if (error) {

        alert(error.message);
        return;

    }


    localStorage.removeItem(
        "grievance_user"
    );


    alert(
        "Logged out successfully."
    );

}


// =====================================================
// CHECK USER
// =====================================================

async function checkUser() {

    const {
        data: {
            user
        }
    } =
        await supabaseClient.auth.getUser();


    if (user) {

        console.log(
            "Logged in user:",
            user.email
        );

    } else {

        console.log(
            "No user logged in."
        );

    }

}

checkUser();


// =====================================================
// SLIDER
// =====================================================

// Tumhare HTML mein same id 3 baar hai.
// Isliye querySelectorAll use kar rahe hain.

const slider = document.querySelector(".slider");
const slideImages = Array.from(document.querySelectorAll(".slider img"));
const dots = document.querySelectorAll(".dot");

let currentSlide = 0;

// Photos ko random order me arrange karega
function shuffleImages(images) {
    for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]];
    }
    return images;
}

// Har page refresh par photos ka order change hoga
shuffleImages(slideImages).forEach(img => {
    slider.insertBefore(img, slider.querySelector(".prev"));
});

function showSlide(index) {
    if (!slideImages.length) return;

    currentSlide = (index + slideImages.length) % slideImages.length;

    slideImages.forEach((img, i) => {
        img.style.display = i === currentSlide ? "block" : "none";
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === currentSlide);
    });
}

function nextSlide() {
    showSlide(currentSlide + 1);
}

function prevSlide() {
    showSlide(currentSlide - 1);
}

// Start
showSlide(0);

// Automatically change every 4 seconds
setInterval(nextSlide, 4000);

       
   


// =====================================================
// AI COMPLAINT ANALYSIS
// =====================================================

function analyzeComplaint(text) {

    const complaint =
        text.toLowerCase();


    let category =
        "General";

    let department =
        "General Department";

    let priority =
        "Medium";


    // WATER

    if (
        complaint.includes("water") ||
        complaint.includes("pipeline") ||
        complaint.includes("leakage") ||
        complaint.includes("drainage") ||
        complaint.includes("pani")
    ) {

        category =
            "Water";

        department =
            "Water Department";

    }


    // ELECTRICITY

    else if (
        complaint.includes("electricity") ||
        complaint.includes("electric") ||
        complaint.includes("street light") ||
        complaint.includes("power") ||
        complaint.includes("bijli")
    ) {

        category =
            "Electricity";

        department =
            "Electricity Department";

    }


    // ROAD

    else if (
        complaint.includes("road") ||
        complaint.includes("pothole") ||
        complaint.includes("street") ||
        complaint.includes("sadak")
    ) {

        category =
            "Road";

        department =
            "Road & Transport Department";

    }


    // GARBAGE

    else if (
        complaint.includes("garbage") ||
        complaint.includes("waste") ||
        complaint.includes("dirty") ||
        complaint.includes("kachra")
    ) {

        category =
            "Garbage";

        department =
            "Municipal Department";

    }


    // HEALTH

    else if (
        complaint.includes("hospital") ||
        complaint.includes("health") ||
        complaint.includes("medical") ||
        complaint.includes("doctor")
    ) {

        category =
            "Healthcare";

        department =
            "Health Department";

    }


    // PRIORITY

    if (
        complaint.includes("emergency") ||
        complaint.includes("danger") ||
        complaint.includes("accident") ||
        complaint.includes("urgent") ||
        complaint.includes("fire") ||
        complaint.includes("dangerous")
    ) {

        priority =
            "High";

    }

    else if (
        complaint.includes("problem") ||
        complaint.includes("issue") ||
        complaint.includes("not working") ||
        complaint.includes("broken")
    ) {

        priority =
            "Medium";

    }

    else {

        priority =
            "Low";

    }


    return {
        category,
        department,
        priority
    };

}



// =====================================================
// CAMERA SYSTEM
// =====================================================

async function openCamera() {

    const modal = document.getElementById("cameraModal");
    const video = document.getElementById("cameraPreview");
    const message = document.getElementById("cameraMessage");

    if (!modal || !video) return;

    modal.hidden = false;
    modal.style.display = "grid";

    if (!navigator.mediaDevices?.getUserMedia) {
        message.textContent = "Camera is not supported in this browser.";
        return;
    }

    message.textContent = "Requesting camera permission...";

    try {

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: {
                    ideal: "environment"
                },
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 720
                }
            },
            audio: false
        });

        video.srcObject = cameraStream;

        await video.play();

        message.textContent = "Camera is ready. 📷";

    } catch (error) {

        console.error("Camera error:", error);

        message.textContent =
            "Camera permission denied. Please allow camera access.";

    }
}


// =====================================================
// CAPTURE PHOTO
// =====================================================

function capturePhoto() {

    const video = document.getElementById("cameraPreview");
    const message = document.getElementById("cameraMessage");
    const photoPreview =
        document.getElementById("capturedPhotoPreview");

    if (!video.videoWidth || !video.videoHeight) {

        message.textContent = "Camera is not ready.";

        return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    capturedPhotoData =
        canvas.toDataURL("image/jpeg", 0.85);

    if (photoPreview) {

        photoPreview.src = capturedPhotoData;
        photoPreview.hidden = false;
        photoPreview.style.display = "block";
    }

    message.textContent = "✅ Photo captured!";

    setTimeout(() => {
        closeCamera();
    }, 500);
}


// =====================================================
// CLOSE CAMERA
// =====================================================

function closeCamera() {

    if (cameraStream) {

        cameraStream.getTracks().forEach(track => {
            track.stop();
        });

        cameraStream = null;
    }

    const video =
        document.getElementById("cameraPreview");

    if (video) {
        video.srcObject = null;
    }

    const modal =
        document.getElementById("cameraModal");

    if (modal) {

        modal.hidden = true;
        modal.style.display = "none";
    }
}

// =====================================================
// LOCATION
// =====================================================

async function getLocation() {

    const locationText =
        document.getElementById(
            "locationText"
        );


    const addressInput =
        document.getElementById(
            "address"
        );


    if (!navigator.geolocation) {

        locationText.textContent =
            "Location unavailable";

        return;

    }


    locationText.textContent =
        "Getting location...";


    navigator.geolocation.getCurrentPosition(

        async function (position) {

            window.userLatitude =
                position.coords.latitude;


            window.userLongitude =
                position.coords.longitude;


            locationText.textContent =
                "Location detected ✓";


            // Coordinates address mein nahi
            // bhar rahe, sirf coordinates save honge.

            console.log(
                "Latitude:",
                window.userLatitude
            );

            console.log(
                "Longitude:",
                window.userLongitude
            );

        },


        function (error) {

            console.error(error);


            locationText.textContent =
                "Location permission denied";


            alert(
                "Please allow location permission."
            );

        },


        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }

    );

}


// =====================================================
// GENERATE TICKET ID
// =====================================================

function generateTicketId() {

    const random =
        Math.floor(
            10000 +
            Math.random() * 90000
        );


    return "GA" + random;

}


// =====================================================
// UPLOAD PHOTO TO SUPABASE STORAGE
// =====================================================

async function uploadPhoto(
    ticketId
) {

    if (!capturedPhotoData) {

        return null;

    }


    // Base64 ko Blob mein convert

    const response =
        await fetch(
            capturedPhotoData
        );


    const blob =
        await response.blob();


    const fileName =
        `${ticketId}-${Date.now()}.jpg`;


    // IMPORTANT:
    // Screenshot mein bucket name
    // "complain-photos" hai.

    const {
        data,
        error
    } =
        await supabaseClient
            .storage
            .from("complain-photos")
            .upload(
                fileName,
                blob,
                {
                    contentType:
                        "image/jpeg",

                    upsert:
                        false
                }
            );


    if (error) {

        console.error(
            "Photo upload error:",
            error
        );

        throw error;

    }


    const {
        data: publicData
    } =
        supabaseClient
            .storage
            .from("complain-photos")
            .getPublicUrl(
                fileName
            );


    return publicData.publicUrl;

}


// =====================================================
// COMPLAINT FORM
// =====================================================

const form =
    document.getElementById(
        "complaintForm"
    );


if (form) {

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const submitButton =
                form.querySelector(
                    "button[type=submit]"
                );


            const resultBox =
                document.getElementById(
                    "ticketResult"
                );


            const name =
                document.getElementById(
                    "name"
                ).value.trim();


            const phone =
                document.getElementById(
                    "phone"
                ).value.trim();


            const email =
                document.getElementById(
                    "email"
                ).value.trim();


            const address =
                document.getElementById(
                    "address"
                ).value.trim();


            const complaint =
                document.getElementById(
                    "complaint"
                ).value.trim();


            // VALIDATION

            if (
                !name ||
                !phone ||
                !email ||
                !address ||
                !complaint
            ) {

                alert(
                    "Please fill all required fields."
                );

                return;

            }


            if (
                !/^[0-9]{10}$/.test(
                    phone
                )
            ) {

                alert(
                    "Enter valid 10 digit mobile number."
                );

                return;

            }


            submitButton.disabled =
                true;

            submitButton.textContent =
                "Submitting...";


            resultBox.innerHTML =
                "<p>AI is analysing your complaint...</p>";


            try {

                // ================= USER =================

                const {
                    data: {
                        user
                    }
                } =
                    await supabaseClient.auth
                        .getUser();


                // ================= TICKET =================

                const ticketId =
                    generateTicketId();


                // ================= AI =================

                const analysis =
                    analyzeComplaint(
                        complaint
                    );


                // ================= ETA & SLA DEADLINE =================
                let eta = "3-5 working days";
                let slaHours = 48;

                if (analysis.priority === "High") {
                    eta = "24-48 hours";
                    slaHours = 24;
                } else if (analysis.priority === "Low") {
                    eta = "5-7 working days";
                    slaHours = 72;
                }

                const deadlineAt = new Date(Date.now() + slaHours * 3600000).toISOString();


                // ================= PHOTO =================

                let photoUrl =
                    null;


                if (capturedPhotoData) {

                    photoUrl =
                        await uploadPhoto(
                            ticketId
                        );

                }


                // ================= DATABASE =================
                const complaintPayload = {
                    ticket_id: ticketId,
                    user_id: user ? user.id : null,
                    name: name,
                    phone: phone,
                    email: email,
                    address: address,
                    complaint: complaint,
                    category: analysis.category,
                    priority: analysis.priority,
                    department: analysis.department,
                    latitude: window.userLatitude,
                    longitude: window.userLongitude,
                    photo_url: photoUrl,
                    status: "Submitted",
                    estimated_resolution: eta
                };

                // Try insert with escalation fields, fallback to basic if extra columns not added yet
                let data, error;
                const advancedTry = await supabaseClient
                    .from("complaints")
                    .insert({
                        ...complaintPayload,
                        deadline_at: deadlineAt,
                        initial_department: analysis.department,
                        escalated: false
                    })
                    .select()
                    .single();

                if (!advancedTry.error) {
                    data = advancedTry.data;
                } else {
                    const basicTry = await supabaseClient
                        .from("complaints")
                        .insert(complaintPayload)
                        .select()
                        .single();
                    data = basicTry.data;
                    error = basicTry.error;
                }

                if (error) {

                    throw error;

                }

                // ================= SEND ALERT TO DATABASE =================
                await sendComplaintAlert(
                    ticketId,
                    name,
                    complaint,
                    analysis
                );

                // ================= SUCCESS =================

                resultBox.innerHTML = `

                    <div style="
                        margin-top:15px;
                        padding:16px;
                        border-radius:12px;
                        background:#eafbea;
                        color:#176b2c;
                    ">

                        <h3>
                            ✅ Complaint Submitted
                        </h3>

                        <p>
                            <b>Ticket ID:</b>
                            ${escapeHtml(data.ticket_id)}
                        </p>

                        <p>
                            <b>Category:</b>
                            ${escapeHtml(data.category)}
                        </p>

                        <p>
                            <b>Department:</b>
                            ${escapeHtml(data.department)}
                        </p>

                        <p>
                            <b>Priority:</b>
                            ${escapeHtml(data.priority)}
                        </p>

                        <p>
                            <b>Status:</b>
                            ${escapeHtml(data.status)}
                        </p>

                        <p>
                            <b>ETA:</b>
                            ${escapeHtml(
                                data.estimated_resolution
                            )}
                        </p>

                    </div>

                `;


                // RESET

                form.reset();

                capturedPhotoData =
                    "";


                window.userLatitude =
                    null;

                window.userLongitude =
                    null;


                const photoPreview =
                    document.getElementById(
                        "capturedPhotoPreview"
                    );


                photoPreview.hidden =
                    true;

                photoPreview.src =
                    "";


                document.getElementById(
                    "locationText"
                ).textContent =
                    "Use Current Location";


            }

            catch (error) {

                console.error(
                    "Complaint submission error:",
                    error
                );


                resultBox.innerHTML = `

                    <div style="
                        margin-top:15px;
                        padding:16px;
                        border-radius:12px;
                        background:#ffeaea;
                        color:#a00000;
                    ">

                        ❌
                        ${escapeHtml(
                            error.message
                        )}

                    </div>

                `;

            }


            finally {

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    "Submit Grievance →";

            }

        }
    );

}


// =====================================================
// TRACK COMPLAINT
// =====================================================

async function trackComplaint() {

    const ticket =
        document.getElementById(
            "ticketInput"
        )?.value.trim();


    if (!ticket) {

        alert(
            "Please enter your Ticket ID."
        );

        return;

    }


    const resultsBox =
        document.getElementById("trackResult") ||
        document.getElementById("searchResults");


    resultsBox.innerHTML =
        "<p>🔍 Searching ticket & checking SLA...</p>";


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("complaints")
                .select("*")
                .eq(
                    "ticket_id",
                    ticket
                )
                .maybeSingle();


        if (error) {

            throw error;

        }


        if (!data) {

            resultsBox.innerHTML =
                "<p style='color:#dc2626;'>❌ Ticket not found. Please check the Ticket ID.</p>";

            return;

        }

        // ================= SLA & ESCALATION CHECK =================
        const sla = getComplaintSLA(data);
        const isAlreadyEscalated = Boolean(
            data.escalated ||
            (data.status && data.status.toLowerCase().includes("escalat"))
        );

        // If time is over and complaint is not resolved, auto-escalate!
        if (sla.isOverdue && !isAlreadyEscalated && data.status !== "Resolved") {
            await autoEscalateComplaint(data);
            data.escalated = true;
            data.status = "Escalated to Higher Authority";
            data.escalated_to = getHigherDepartment(data.initial_department || data.department);
            data.department = data.escalated_to;
        }

        const isEscalatedNow = Boolean(
            data.escalated ||
            (data.status && data.status.toLowerCase().includes("escalat"))
        );
        const higherDeptName = data.escalated_to || getHigherDepartment(data.initial_department || data.department);

        resultsBox.innerHTML = `

            <div style="
                margin-top:15px;
                padding:20px;
                background:white;
                border-radius:14px;
                border:1px solid #eee;
                box-shadow: 0 4px 15px rgba(0,0,0,0.06);
            ">

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; border-bottom:1px solid #f2e4d1; padding-bottom:10px;">
                    <h3 style="margin:0; font-size:20px; color:#14243b;">
                        🎫 Ticket: ${escapeHtml(data.ticket_id)}
                    </h3>
                    <span style="
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-weight: bold;
                        font-size: 13px;
                        background: ${isEscalatedNow ? '#ffebee' : (data.status === 'Resolved' ? '#e8f5e9' : '#fff3e0')};
                        color: ${isEscalatedNow ? '#c62828' : (data.status === 'Resolved' ? '#2e7d32' : '#e65100')};
                        border: 1px solid ${isEscalatedNow ? '#ef9a9a' : (data.status === 'Resolved' ? '#a5d6a7' : '#ffe082')};
                    ">
                        ${escapeHtml(data.status || 'Submitted')}
                    </span>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px; font-size:14px;">
                    <p><b>Category:</b> ${escapeHtml(data.category || '-')}</p>
                    <p><b>Priority:</b> <span style="font-weight:bold; color:${data.priority === 'High' ? '#dc2626' : '#222'};">${escapeHtml(data.priority || 'Normal')}</span></p>
                    <p><b>Current Department:</b> ${escapeHtml(data.department || '-')}</p>
                    <p><b>Estimated Resolution:</b> ${escapeHtml(data.estimated_resolution || '24-48 hours')}</p>
                </div>

                <!-- SLA TIMER BADGE -->
                <div style="
                    margin-top:14px;
                    padding:10px 14px;
                    border-radius:8px;
                    background: ${sla.isOverdue ? '#fff1f2' : '#f0fdf4'};
                    border-left: 4px solid ${sla.isOverdue ? '#e11d48' : '#22c55e'};
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    flex-wrap:wrap;
                    gap:6px;
                ">
                    <span style="font-weight:bold; font-size:13px; color:#333;">
                        ${sla.isOverdue ? '⚠️ SLA Resolution Deadline Expired' : '⏱️ SLA Action Window'}
                    </span>
                    <span style="
                        font-weight:bold;
                        font-size:13px;
                        color: ${sla.isOverdue ? '#be123c' : '#15803d'};
                    ">
                        ${escapeHtml(sla.timeText)}
                    </span>
                </div>

                <!-- ESCALATION DETAILS BOX -->
                ${isEscalatedNow ? `
                    <div class="escalation-box" style="margin-top:16px;">
                        <h3>🚨 Escalated to Higher Authority</h3>
                        <p><strong>Transferred To:</strong> ${escapeHtml(higherDeptName)}</p>
                        <p><strong>Reason:</strong> Department SLA exceeded standard turnaround limit (${sla.slaHours}h).</p>
                        <p><strong>Action Status:</strong> High-priority alert dispatched to Senior HOD & District Magistrate Level.</p>
                        <p><strong>Escalated At:</strong> ${data.escalated_at ? new Date(data.escalated_at).toLocaleString() : 'Recently'}</p>
                    </div>
                ` : `
                    <div style="margin-top:14px; text-align:right;">
                        <button type="button" onclick="testSimulateEscalation('${escapeHtml(data.ticket_id)}')" style="
                            background: #fff7ed;
                            border: 1px solid #ffedd5;
                            color: #c2410c;
                            padding: 6px 12px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: bold;
                        ">
                            ⚡ Test: Simulate SLA Time Expired (Escalate to HOD)
                        </button>
                    </div>
                `}

            </div>

        `;

    }

    catch (error) {

        console.error(error);

        resultsBox.innerHTML =
            `<p style="color:#dc2626;">❌ ${escapeHtml(error.message)}</p>`;

    }

}


// =====================================================
// SEARCH COMPLAINTS
// =====================================================

async function searchComplaints() {
    const input = document.getElementById("searchInput");
    const results = document.getElementById("searchResults");

    const searchText = input.value.trim();

    if (!searchText) {
        results.innerHTML = "<p>Please enter something to search.</p>";
        return;
    }

    results.innerHTML = "<p>Searching...</p>";

    try {
        const { data, error } = await supabaseClient
            .from("complaints")
            .select("*")
            .or(
                `ticket_id.ilike.%${searchText}%,` +
                `name.ilike.%${searchText}%,` +
                `phone.ilike.%${searchText}%,` +
                `email.ilike.%${searchText}%,` +
                `category.ilike.%${searchText}%,` +
                `complaint.ilike.%${searchText}%`
            )
            .limit(20);

        if (error) {
            console.error("Search error:", error);
            results.innerHTML =
                `<p style="color:red;">Database Error: ${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data || data.length === 0) {
            results.innerHTML = "<p>No complaints found.</p>";
            return;
        }

        results.innerHTML = data.map(item => `
            <div class="search-result-card">
                <h3>${escapeHtml(item.ticket_id || "No Ticket ID")}</h3>

                <p>
                    <strong>Name:</strong>
                    ${escapeHtml(item.name || "-")}
                </p>

                <p>
                    <strong>Category:</strong>
                    ${escapeHtml(item.category || "-")}
                </p>

                <p>
                    <strong>Complaint:</strong>
                    ${escapeHtml(item.complaint || "-")}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${escapeHtml(item.status || "Pending")}
                </p>

                <p>
                    <strong>Priority:</strong>
                    ${escapeHtml(item.priority || "-")}
                </p>
            </div>
        `).join("");

    } catch (err) {
        console.error("Search failed:", err);

        results.innerHTML =
            `<p style="color:red;">Search failed: ${escapeHtml(err.message)}</p>`;
    }
}

// =====================================================
// HTML SECURITY
// =====================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /[&<>'"]/g,
            character => ({

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "'": "&#39;",
                "\"": "&quot;"

            })[character]
        );

}


// =====================================================
// DATABASE ALERTS SYSTEM
// =====================================================

async function sendComplaintAlert(ticketId, name, complaintText, analysis) {
    try {
        const priority = analysis?.priority || "Normal";
        const department = analysis?.department || "General";
        const category = analysis?.category || "General";
        const title = `🚨 New Grievance: ${priority} Priority`;
        const message = `Citizen ${name} reported an issue in ${department} (${category}): "${complaintText.slice(0, 90)}..."`;

        const { data, error } = await supabaseClient
            .from("alerts")
            .insert({
                ticket_id: ticketId,
                title: title,
                message: message,
                priority: priority,
                department: department,
                category: category,
                status: "Unread"
            })
            .select()
            .single();

        if (error) {
            console.warn("Notice inserting alert to database:", error.message);
        } else {
            console.log("✅ Alert sent to Supabase alerts table successfully:", data);
        }

        // Show live on-screen toast alert
        showToastAlert(
            `🔔 Alert Sent to Database!`,
            `Ticket #${ticketId} logged in ${department} with ${priority} priority.`,
            priority
        );

        // Refresh alerts count & modal
        loadDatabaseAlerts();

    } catch (err) {
        console.warn("Error sending alert to database:", err);
    }
}

function showToastAlert(title, message, priority = "Normal") {
    const container = document.getElementById("toastAlertContainer");
    if (!container) return;

    const toast = document.createElement("div");
    const isHigh = priority === "High";
    toast.style.cssText = `
        pointer-events: auto;
        min-width: 280px;
        max-width: 360px;
        background: ${isHigh ? "#fff3cd" : "#e8f4fd"};
        border-left: 5px solid ${isHigh ? "#dc3545" : "#ff6b00"};
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        animation: fadeInRight 0.3s ease-in-out;
        color: #222;
        font-family: inherit;
    `;

    toast.innerHTML = `
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>${escapeHtml(title)}</span>
            <span style="cursor:pointer; margin-left: 8px; font-size: 18px;" onclick="this.parentElement.parentElement.remove()">&times;</span>
        </div>
        <div style="font-size: 13px; color: #444; line-height: 1.4;">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 6000);
}

function toggleAlertsModal() {
    const modal = document.getElementById("alertsModal");
    if (!modal) return;
    const isHidden = modal.hidden;
    modal.hidden = !isHidden;
    modal.style.display = isHidden ? "grid" : "none";
    if (isHidden) {
        loadDatabaseAlerts();
    }
}

async function loadDatabaseAlerts() {
    const listEl = document.getElementById("alertsList");
    const badgeEl = document.getElementById("alertCountBadge");
    if (!listEl) return;

    try {
        let alertsData = [];

        // 1. Pehle alerts table try karo
        const alertsTry = await supabaseClient
            .from("alerts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);

        if (!alertsTry.error && alertsTry.data && alertsTry.data.length > 0) {
            alertsData = alertsTry.data;
        } else {
            // 2. Agar alerts table nahi hai ya empty hai, to direct Supabase complaints table se real-time alerts load karo
            const complaintsTry = await supabaseClient
                .from("complaints")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(20);

            if (!complaintsTry.error && complaintsTry.data) {
                alertsData = complaintsTry.data.map(item => {
                    const isEscalated = Boolean(
                        item.escalated ||
                        (item.status && item.status.toLowerCase().includes("escalat"))
                    );
                    const isHigh = item.priority === "High";

                    let alertTitle = "📋 Nayi Grievance Report Hui";
                    if (isEscalated) {
                        alertTitle = `🚨 TIME EXPIRED: Escalated to ${item.escalated_to || 'Higher Authority'}`;
                    } else if (isHigh) {
                        alertTitle = `🔥 HIGH PRIORITY: Urgent Civic Alert`;
                    }

                    return {
                        ticket_id: item.ticket_id,
                        title: alertTitle,
                        message: `${item.name || 'Citizen'} ne ${item.department || 'General'} me complaint darj ki: "${(item.complaint || '').slice(0, 85)}..."`,
                        priority: isEscalated ? "High" : (item.priority || "Normal"),
                        department: item.escalated_to || item.department,
                        created_at: item.created_at
                    };
                });
            }
        }

        if (!alertsData || alertsData.length === 0) {
            listEl.innerHTML = `<p style="text-align:center;color:#888;padding:25px;">No alerts in database yet.</p>`;
            if (badgeEl) badgeEl.style.display = "none";
            return;
        }

        if (badgeEl) {
            badgeEl.textContent = alertsData.length;
            badgeEl.style.display = "inline-block";
        }

        listEl.innerHTML = alertsData.map(item => {
            const isHigh = item.priority === "High" || item.priority === "Critical" || item.title?.includes("🚨") || item.title?.includes("🔥");
            return `
            <div style="border: 1px solid #eee; border-left: 4px solid ${isHigh ? '#dc3545' : '#ff8a00'}; border-radius: 8px; padding: 12px; background: #fafafa;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                    <strong style="font-size: 14px; color: ${isHigh ? '#dc3545' : '#14243b'};">${escapeHtml(item.title)}</strong>
                    <span style="font-size: 11px; background: ${isHigh ? '#ffebee' : '#fff3e0'}; color: ${isHigh ? '#c62828' : '#e65100'}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                        ${escapeHtml(item.priority || "Normal")}
                    </span>
                </div>
                <p style="font-size: 13px; color: #555; margin: 6px 0; line-height: 1.4;">${escapeHtml(item.message)}</p>
                <div style="font-size: 11px; color: #999; display: flex; justify-content: space-between; margin-top: 6px;">
                    <span>Ticket: <b>${escapeHtml(item.ticket_id || "-")}</b></span>
                    <span>${item.created_at ? new Date(item.created_at).toLocaleString([], {month:'short', day:'numeric', hour: '2-digit', minute:'2-digit'}) : ""}</span>
                </div>
            </div>
            `;
        }).join("");

    } catch (err) {
        console.warn("Failed to load alerts from Supabase:", err);
    }
}

// Live Supabase Realtime alerts listener connected to Supabase
function initRealtimeAlerts() {
    try {
        // 1. Supabase complaints channel (jab bhi naya report submit ho ya update ho)
        supabaseClient
            .channel("realtime-complaints-alerts")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "complaints" }, (payload) => {
                const item = payload.new;
                console.log("🔔 Supabase Live Report Received:", item);
                showToastAlert(
                    `🚨 Nayi Grievance Aayi! (${item.priority || 'Normal'})`,
                    `${item.name || 'Citizen'} ne ${item.department} me complaint report ki hai (Ticket #${item.ticket_id})`,
                    item.priority
                );
                loadDatabaseAlerts();
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "complaints" }, (payload) => {
                const item = payload.new;
                if (item.status && item.status.includes("Escalat")) {
                    showToastAlert(
                        `🚨 TIME EXPIRED: Higher Department Alert!`,
                        `Ticket #${item.ticket_id} transferred to ${item.escalated_to || item.department}`,
                        "High"
                    );
                }
                loadDatabaseAlerts();
            })
            .subscribe();

        // 2. Supabase alerts table channel
        supabaseClient
            .channel("realtime-database-alerts")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
                const newAlert = payload.new;
                showToastAlert(
                    newAlert.title || "🚨 Grievance Alert!",
                    newAlert.message || "New alert in database",
                    newAlert.priority
                );
                loadDatabaseAlerts();
            })
            .subscribe();

    } catch (err) {
        console.warn("Realtime alerts subscription error:", err);
    }
}

// =====================================================
// AUTOMATED HIGHER DEPARTMENT ESCALATION SYSTEM
// =====================================================

function getHigherDepartment(dept) {
    const matrix = {
        "Electricity Department": "Chief Engineer (Electricity Board) & State Energy Commission",
        "Water Supply Department": "Superintending Engineer (Jal Sansthan) & Ministry of Jal Shakti",
        "Road & Transport Department": "Chief Engineer (PWD) & Transport Commissioner",
        "Municipal Department": "Municipal Commissioner & Urban Development Directorate",
        "Health Department": "Chief Medical Officer (CMO) & Directorate of Health Services",
        "Healthcare": "Chief Medical Officer (CMO) & Directorate of Health Services",
        "Garbage": "Municipal Commissioner & Urban Sanitation Directorate",
        "Road": "Chief Engineer (PWD) & Transport Directorate",
        "Water": "Superintending Engineer (Jal Sansthan) & Ministry of Jal Shakti",
        "Electricity": "Chief Engineer (Electricity Board) & State Energy Commission",
        "General Administration": "District Magistrate (DM) & Higher Appellate Grievance Cell"
    };

    return matrix[dept] || "District Magistrate (DM) & Higher Grievance Appellate Authority";
}

function getComplaintSLA(complaint) {
    const priority = complaint?.priority || "Medium";
    let slaHours = 48; // Standard 48h
    if (priority === "High") slaHours = 24; // Emergency 24h
    else if (priority === "Low") slaHours = 72; // Low 72h

    const createdAt = complaint?.created_at ? new Date(complaint.created_at) : new Date();
    const deadline = complaint?.deadline_at 
        ? new Date(complaint.deadline_at) 
        : new Date(createdAt.getTime() + slaHours * 3600000);

    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const isOverdue = diffMs <= 0;

    let timeText = "";
    if (isOverdue) {
        const pastHours = Math.floor(Math.abs(diffMs) / 3600000);
        const pastMins = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
        timeText = `Time Expired (${pastHours}h ${pastMins}m ago)`;
    } else {
        const remHours = Math.floor(diffMs / 3600000);
        const remMins = Math.floor((diffMs % 3600000) / 60000);
        timeText = `${remHours}h ${remMins}m remaining`;
    }

    return {
        deadline,
        slaHours,
        isOverdue,
        timeText,
        diffMs
    };
}

async function autoEscalateComplaint(complaint) {
    const initialDept = complaint.initial_department || complaint.department || "Municipal Department";
    const higherDept = getHigherDepartment(initialDept);
    const nowIso = new Date().toISOString();

    console.warn(`🚨 [ESCALATION] Auto-escalating ticket #${complaint.ticket_id} to ${higherDept}`);

    // 1. Update complaints table in Supabase
    try {
        await supabaseClient
            .from("complaints")
            .update({
                status: "Escalated to Higher Authority",
                department: higherDept,
                escalated: true,
                escalated_to: higherDept,
                escalated_at: nowIso
            })
            .eq("ticket_id", complaint.ticket_id);
    } catch (err) {
        console.warn("Update complaint escalation err:", err);
    }

    // 2. Insert urgent alert into database
    try {
        await supabaseClient
            .from("alerts")
            .insert({
                ticket_id: complaint.ticket_id,
                title: `🚨 TIME EXPIRED: Escalated to ${higherDept}`,
                message: `Complaint #${complaint.ticket_id} resolution time expired! Case transferred from ${initialDept} to ${higherDept} for urgent intervention.`,
                priority: "High",
                department: higherDept,
                category: complaint.category || "General",
                status: "Unread",
                created_at: nowIso
            });

        showToastAlert(
            "⚠️ Complaint Escalated to Higher Authority!",
            `Ticket #${complaint.ticket_id} time is over. Transferred to ${higherDept}.`,
            "High"
        );

        loadDatabaseAlerts();
    } catch (err) {
        console.warn("Escalation alert insert err:", err);
    }
}

// Demo function: User/Judge can click to simulate SLA time expired
async function testSimulateEscalation(ticketId) {
    if (!ticketId) return;

    try {
        showToastAlert("⏳ Simulating SLA Expiry...", `Expiring time for Ticket #${ticketId}`, "Normal");

        const { data, error } = await supabaseClient
            .from("complaints")
            .select("*")
            .eq("ticket_id", ticketId)
            .single();

        if (error || !data) {
            alert("Ticket not found.");
            return;
        }

        await autoEscalateComplaint(data);

        // Re-run tracking to refresh the UI
        setTimeout(() => {
            trackComplaint();
        }, 600);

    } catch (e) {
        console.error("Test escalation failed:", e);
    }
}

// Background auto-scanner: checks all open complaints for SLA breach
async function checkAllComplaintsSLA() {
    try {
        const { data, error } = await supabaseClient
            .from("complaints")
            .select("*")
            .neq("status", "Resolved")
            .limit(50);

        if (error || !data) return;

        for (const comp of data) {
            const isAlreadyEscalated = Boolean(
                comp.escalated ||
                (comp.status && comp.status.toLowerCase().includes("escalat"))
            );

            if (!isAlreadyEscalated) {
                const sla = getComplaintSLA(comp);
                if (sla.isOverdue) {
                    await autoEscalateComplaint(comp);
                }
            }
        }
    } catch (err) {
        console.warn("Background SLA check skipped:", err);
    }
}

// Initialize on page load
setTimeout(() => {
    loadDatabaseAlerts();
    initRealtimeAlerts();
    checkAllComplaintsSLA();
}, 1200);

// Run background SLA check every 2 minutes
setInterval(checkAllComplaintsSLA, 120000);

// =====================================================
// FINISHED
// =====================================================

console.log(
    "🚀 GrievanceAI loaded with Database Alerts & Higher Department Escalation Matrix."
);