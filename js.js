const API_BASE = "http://localhost:5000";
let capturedPhotoData = "";

function toggleAiChat() {
    const chat = document.getElementById("aiChat");
    chat.hidden = !chat.hidden;
    if (!chat.hidden) document.getElementById("aiQuestion")?.focus();
}

const aiForm = document.getElementById("aiForm");
if (aiForm) {
    aiForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = document.getElementById("aiQuestion");
        const messages = document.getElementById("aiMessages");
        const question = input.value.trim();
        if (!question) return;
        messages.insertAdjacentHTML("beforeend", `<p><b>You:</b> ${question}</p>`);
        input.value = "";
        try {
            const response = await fetch(`${API_BASE}/api/ai/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "AI request failed");
            messages.insertAdjacentHTML("beforeend", `<p><b>AI:</b> ${result.answer}</p>`);
        } catch (error) {
            messages.insertAdjacentHTML("beforeend", `<p><b>AI:</b> ${error.message}</p>`);
        }
        messages.scrollTop = messages.scrollHeight;
    });
}

let authMode = "login";

function openAuth(mode) {
    authMode = mode;
    const modal = document.getElementById("authModal");
    modal.hidden = false;
    modal.style.display = "grid";
    document.getElementById("authTitle").textContent = mode === "login" ? "Login" : "Create account";
    document.getElementById("authSubmit").textContent = mode === "login" ? "Login" : "Sign Up";
    document.getElementById("authMessage").textContent = "";
}

function closeAuth() {
    const modal = document.getElementById("authModal");
    modal.hidden = true;
    modal.style.display = "none";
}

const authForm = document.getElementById("authForm");
if (authForm) {
    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.getElementById("authMessage");
        const submit = document.getElementById("authSubmit");
        submit.disabled = true;
        message.textContent = "Please wait...";

        try {
            const response = await fetch(`${API_BASE}/api/auth/${authMode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: document.getElementById("authEmail").value.trim(),
                    password: document.getElementById("authPassword").value
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Authentication failed");
            localStorage.setItem("grievance_user", JSON.stringify(result.user));
            message.textContent = authMode === "signup" && !result.session
                ? "Account created. Check your email to confirm it, then login."
                : "Login successful.";
            if (result.session) setTimeout(closeAuth, 800);
        } catch (error) {
            message.textContent = error.message;
        } finally {
            submit.disabled = false;
        }
    });
}

    const images = [
        "WhatsApp Image 2026-09-22 at 17.39.03.jpeg",
        "WhatsApp Image 2026-09-22 at 00.28.12.jpeg",
        "WhatsApp Image 2026-09-22 at 00.28.27.jpeg"
    ];

    let currentSlide = 0;
    const slideImage = document.getElementById("slideImage");
    const dots = document.querySelectorAll(".dot");

    function showSlide(index) {
        if (!slideImage) return;
        currentSlide = index;
        slideImage.src = images[currentSlide];
        dots.forEach((dot, i) => dot.classList.toggle("active", i === currentSlide));
    }

    function nextSlide() {
        showSlide((currentSlide + 1) % images.length);
    }

    function prevSlide() {
        showSlide((currentSlide - 1 + images.length) % images.length);
    }

    if (slideImage) setInterval(nextSlide, 4000);

    function renderResult(result) {
        const resultBox = document.getElementById("ticketResult");
        if (!resultBox) return;

        resultBox.innerHTML = `
            <div style="margin-top:15px;padding:15px;background:#fff1dc;border-radius:10px">
                <strong>Complaint Submitted!</strong><br><br>
                <b>Ticket ID:</b> ${result.ticket_id}<br>
                <b>Category:</b> ${result.category}<br>
                <b>Department:</b> ${result.department}<br>
                <b>Priority:</b> ${result.priority}<br>
                <b>ETA:</b> ${result.eta}
            </div>`;
    }

    const form = document.getElementById("complaintForm");
    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const complaint = document.getElementById("complaint").value.trim();
            const submitButton = form.querySelector("button[type=submit]");

            if (!complaint) {
                alert("Please describe your issue.");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";

            try {
                const response = await fetch(`${API_BASE}/api/grievances`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: document.getElementById("name")?.value.trim() || "",
                        phone: document.getElementById("phone")?.value.trim() || "",
                        email: document.getElementById("email")?.value.trim() || "",
                        address: document.getElementById("address")?.value.trim() || "",
                        latitude: window.userLatitude || null,
                        longitude: window.userLongitude || null,
                        photo_data: capturedPhotoData,
                        complaint
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "Submission failed");
                renderResult(result);
                form.reset();
                capturedPhotoData = "";
                document.getElementById("capturedPhotoPreview").hidden = true;
            } catch (error) {
                alert(`Backend connection failed: ${error.message}`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Submit Grievance →";
            }
        });
    }

    async function trackComplaint() {
        const ticket = document.getElementById("ticketInput")?.value.trim();
        if (!ticket) {
            alert("Please enter your Ticket ID.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/grievances/${encodeURIComponent(ticket)}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Ticket not found");
            const grievance = result.grievance;
            alert(`Ticket ${grievance.ticket_id}\nStatus: ${grievance.status}\nDepartment: ${grievance.department}\nETA: ${grievance.eta}`);
        } catch (error) {
            alert(error.message);
        }
    }

    function scrollToForm() {
        document.getElementById("report")?.scrollIntoView({ behavior: "smooth" });
    }

    let cameraStream = null;

    async function openCamera() {
        const modal = document.getElementById("cameraModal");
        const preview = document.getElementById("cameraPreview");
        const message = document.getElementById("cameraMessage");

        if (!navigator.mediaDevices?.getUserMedia) {
            modal.hidden = false;
            modal.style.display = "grid";
            message.textContent = "Live camera is unavailable in this browser. Open the site in Chrome using localhost or 127.0.0.1 and allow Camera permission.";
            return;
        }

        modal.hidden = false;
        modal.style.display = "grid";
        message.textContent = "Camera permission maang raha hai...";

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false
            });
            preview.srcObject = cameraStream;
            message.textContent = "Camera is on.";
        } catch (error) {
            message.textContent = "Camera permission blocked. Browser site settings me Camera > Allow karo.";
            console.error("Camera error:", error);
        }
    }

    const cameraInput = document.getElementById("cameraInput");
    if (cameraInput) {
        cameraInput.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                capturedPhotoData = reader.result;
                const preview = document.getElementById("capturedPhotoPreview");
                preview.src = capturedPhotoData;
                preview.hidden = false;
            };
            reader.readAsDataURL(file);
        });
    }

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
            cameraStream = null;
        }
        const preview = document.getElementById("cameraPreview");
        if (preview) preview.srcObject = null;
        const modal = document.getElementById("cameraModal");
        modal.hidden = true;
        modal.style.display = "none";
    }

    function capturePhoto() {
        const video = document.getElementById("cameraPreview");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (!canvas.width || !canvas.height) {
            document.getElementById("cameraMessage").textContent = "Camera ready hone ke baad dobara capture karo.";
            return;
        }

        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedPhotoData = canvas.toDataURL("image/jpeg", 0.75);
        const preview = document.getElementById("capturedPhotoPreview");
        preview.src = capturedPhotoData;
        preview.hidden = false;
        closeCamera();
    }

    async function getLocation() {
        const locationText = document.getElementById("locationText");
        const addressInput = document.getElementById("address");
        if (!navigator.geolocation) {
            if (locationText) locationText.textContent = "Location unavailable";
            return;
        }
        if (locationText) locationText.textContent = "Getting location...";
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                window.userLatitude = coords.latitude;
                window.userLongitude = coords.longitude;
                if (locationText) locationText.textContent = "Finding place name...";
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`);
                    const place = await response.json();
                    const name = place.display_name || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
                    if (addressInput) addressInput.value = name;
                    if (locationText) locationText.textContent = "Location detected";
                } catch (error) {
                    if (addressInput) addressInput.value = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
                    if (locationText) locationText.textContent = "Coordinates detected";
                }
            },
            (error) => {
                if (locationText) locationText.textContent = error.code === 1 ? "Permission denied - allow Location" : "Unable to detect location";
                alert("Location permission allow karo, tab live location milegi.");
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
        }[character]));
    }

    async function searchComplaints() {
        const query = document.getElementById("searchInput")?.value.trim();
        const resultsBox = document.getElementById("searchResults");
        if (!query) {
            resultsBox.textContent = "Type something to search.";
            return;
        }

        resultsBox.textContent = "Searching...";
        try {
            const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Search failed");
            if (!result.results.length) {
                resultsBox.textContent = "No complaints found.";
                return;
            }
            resultsBox.innerHTML = result.results.map((item) => `
                <article style="background:white;border:1px solid #f0e2cf;border-radius:12px;padding:14px;margin-top:10px">
                    <b>${escapeHtml(item.ticket_id)}</b> · ${escapeHtml(item.status)}<br>
                    ${escapeHtml(item.category)} · ${escapeHtml(item.department)}<br>
                    <small>${escapeHtml(item.complaint)}</small>
                </article>`).join("");
        } catch (error) {
            resultsBox.textContent = error.message;
        }
    }