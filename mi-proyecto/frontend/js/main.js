const token = getToken();

// LÓGICA DE SEGURIDAD
// si existe token porque ya ha iniciado, vamos a la vista de dashboard directamente.
if (token) {
    window.location.href = "../dashboard/dashboard.html";
}

// EVENTOS DE LOGIN
const loginForm = document.getElementById("login-form");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // para que no recargue el formulario
        let identifier = document.getElementById("login-email").value;
        let password = document.getElementById("login-password").value;
        const errorMsg = document.getElementById("login-error");

        identifier = escapeHTML(identifier)
        password = escapeHTML(password)

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.token);
                // redirigir al archivo del tablero
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