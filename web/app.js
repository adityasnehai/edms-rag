const API_BASE = "http://127.0.0.1:8000";

/* ---------------- LOGIN ---------------- */
async function login() {
const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
    "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
    username: email,
    password: password
    })
});

if (!res.ok) {
    alert("Login failed");
    return;
}

const data = await res.json();

  // 🔐 STORE JWT (IMPORTANT)
localStorage.setItem("access_token", data.access_token);

  // ➜ Redirect to search page
window.location.href = "search.html";
}

/* ---------------- SEARCH ---------------- */
async function search() {
const q = document.getElementById("query").value;
  const token = localStorage.getItem("access_token"); // ✅ FIXED

const res = await fetch(
    `${API_BASE}/search?q=${encodeURIComponent(q)}`,
    {
    headers: {
        "Authorization": "Bearer " + token
    }}
);

if (res.status === 401) {
    alert("Session expired. Please login again.");
    logout();
    return;
}

const data = await res.json();
document.getElementById("result").innerText =
    JSON.stringify(data, null, 2);
}

/* ---------------- LOGOUT ---------------- */
function logout() {
localStorage.removeItem("access_token");
window.location.href = "index.html";
}
