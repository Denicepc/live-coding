const token = getToken();

// LÓGICA DE SEGURIDAD
// Si ya hay token, saltamos al dashboard
if (token) {
    window.location.href = "../dashboard/dashboard.html";
}

// EVENTOS DE REGISTRO
const registerForm = document.getElementById("register-form");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("reg-username").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg1-password").value;
        const confirmPassword = document.getElementById("reg2-password").value;
        const errorMsg = document.getElementById("reg-error");

        if(password !== confirmPassword) {
            errorMsg.textContent = "Las contraseñas no coinciden";
            errorMsg.classList.remove("hidden");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password, confirmPassword })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.token);
                window.location.href = "../dashboard/dashboard.html";
            } else {
                errorMsg.textContent = data.error;
                errorMsg.classList.remove("hidden");
            }
        } catch (error) {
            errorMsg.textContent = "Error de conexión.";
            errorMsg.classList.remove("hidden");
        }
    });
}