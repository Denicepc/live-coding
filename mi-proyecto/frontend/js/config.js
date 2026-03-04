const API_URL = "http://localhost:3000/api";

function getToken() {
    return localStorage.getItem("token");
}

// Función para comprobar si el token ha caducado
function isTokenExpired(token) {
    if (!token) return true;
    
    try {
        // El JWT tiene 3 partes separadas por puntos. La segunda es el payload.
        // atob() decodifica la base64
        const payloadBase64 = token.split('.')[1];
        const decodedJson = atob(payloadBase64);
        const payload = JSON.parse(decodedJson);
        
        // 'exp' viene en segundos, Date.now() en milisegundos
        const expirationTime = payload.exp * 1000; 
        
        // Devuelve true si la fecha actual es mayor a la de expiración
        return Date.now() >= expirationTime;
    } catch (error) {
        // Si el token está mal formado, asumimos que es inválido
        return true; 
    }
}

// Convierte caracteres especiales en texto plano inofensivo para que no ataquen a través de la creación o edición de notas
function escapeHTML(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
