const API_URL = "http://localhost:3000/api";
let token = localStorage.getItem("token");

// Referencias a elementos clave para saber en qué página estamos
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutBtn = document.getElementById("logout-btn");

// LÓGICA DE RUTAS Y SEGURIDAD CLIENTE
if (loginForm || registerForm) {
    // Si estamos en Login o Registro y YA hay token, saltamos al dashboard
    if (token) {
        window.location.href = "dashboard.html";
    }
} else if (logoutBtn) {
    // Si estamos en el Dashboard y NO hay token, te expulso al login
    if (!token) {
        window.location.href = "index.html";
    } else {
        // Solo si hay token y estamos en el dashboard, cargamos las notas
        fetchNotes();
    }
}

// ==========================================
// EVENTOS DE LOGIN (Solo si existe en la página)
// ==========================================
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identifier = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const errorMsg = document.getElementById("login-error");

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.token);
                // Redirigir al archivo del tablero
                window.location.href = "dashboard.html"; 
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

// ==========================================
// EVENTOS DE REGISTRO (Solo si existe en la página)
// ==========================================
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
                window.location.href = "dashboard.html";
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

// ==========================================
// EVENTOS DEL DASHBOARD (CRUD NOTAS)
// ==========================================
if (logoutBtn) {
    
    // CERRAR SESIÓN
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "index.html"; // Redirigir al login
    });

    // CREAR NOTA
    document.getElementById("create-note-btn").addEventListener("click", async () => {
        const titleInput = document.getElementById("new-note-title");
        const contentInput = document.getElementById("new-note-content");

        if (!titleInput.value.trim()) return alert("El título es obligatorio");

        try {
            const response = await fetch(`${API_URL}/notes`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({ title: titleInput.value, content: contentInput.value })
            });

            if (response.ok) {
                titleInput.value = "";
                contentInput.value = "";
                fetchNotes();
            } else {
                const err = await response.json();
                alert("Error: " + err.error);
            }
        } catch (error) {
            console.error(error);
        }
    });
}

// FUNCIONES GLOBALES PARA NOTAS (Se llaman desde el HTML)

async function fetchNotes() {
    try {
        const response = await fetch(`${API_URL}/notes`, {
            method: "GET",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderNotes(data.notes);
        } else if (response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "index.html";
        }
    } catch (error) {
        console.error(error);
    }
}

function renderNotes(notes) {
    const container = document.getElementById("notes-container");
    container.innerHTML = ""; 

    notes.forEach(note => {
        const noteDiv = document.createElement("div");
        // Aseguramos que el color por defecto coincida con el backend
        noteDiv.className = `sticky-note bg-[${note.color || '#fef08a'}] p-6 h-64 relative rotate-1 flex flex-col`;
        
        noteDiv.innerHTML = `
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 pushpin">
                <div class="w-4 h-4 bg-red-600 rounded-full border-2 border-white/30"></div>
            </div>
            
            <input type="text" id="title-${note.id}" value="${note.title}" disabled
                class="form-input p-1 border-0 focus:ring-0 bg-transparent disabled:bg-transparent disabled:opacity-100 disabled:text-slate-900 font-bold text-xl mb-1 w-full transition-colors rounded">
            
            <textarea id="content-${note.id}" disabled
                class="form-textarea p-1 border-0 focus:ring-0 bg-transparent disabled:bg-transparent disabled:opacity-100 disabled:text-slate-900 font-handwritten text-lg flex-1 w-full resize-none transition-colors rounded">${note.content}</textarea>
            
            <div class="flex gap-2 justify-end mt-2">
                <button id="edit-btn-${note.id}" onclick="toggleEditMode('${note.id}')" 
                    class="bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 transition-colors font-bold shadow-sm">
                    Editar
                </button>
                <button onclick="deleteNote('${note.id}')" 
                    class="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors font-bold shadow-sm">
                    Borrar
                </button>
            </div>
        `;
        container.appendChild(noteDiv);
    });
}

async function deleteNote(noteId) {
    if (!confirm("¿Seguro que quieres borrar esta nota?")) return;
    try {
        const response = await fetch(`${API_URL}/notes/${noteId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) fetchNotes();
    } catch (error) {
        console.error(error);
    }
}

async function toggleEditMode(noteId) {
    const titleInput = document.getElementById(`title-${noteId}`);
    const contentInput = document.getElementById(`content-${noteId}`);
    const editBtn = document.getElementById(`edit-btn-${noteId}`);

    const isEditing = !titleInput.disabled;

    if (isEditing) {
        const newTitle = titleInput.value.trim();
        const newContent = contentInput.value.trim();

        if (!newTitle) {
            alert("El título no puede estar vacío.");
            titleInput.focus();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/notes/${noteId}`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({ title: newTitle, content: newContent })
            });

            if (response.ok) {
                titleInput.disabled = true;
                contentInput.disabled = true;
                titleInput.classList.replace('bg-white/50', 'bg-transparent');
                contentInput.classList.replace('bg-white/50', 'bg-transparent');
                editBtn.textContent = "Editar";
                editBtn.classList.replace('bg-green-500', 'bg-orange-500');
                editBtn.classList.replace('hover:bg-green-600', 'hover:bg-orange-700');
            } else {
                const data = await response.json();
                alert("Error al editar: " + data.error);
            }
        } catch (error) {
            alert("Ocurrió un error al guardar los cambios.");
        }
    } else {
        titleInput.disabled = false;
        contentInput.disabled = false;
        titleInput.classList.replace('bg-transparent', 'bg-white/50');
        contentInput.classList.replace('bg-transparent', 'bg-white/50');
        editBtn.textContent = "Guardar";
        editBtn.classList.replace('bg-orange-500', 'bg-green-500');
        editBtn.classList.replace('hover:bg-orange-700', 'hover:bg-green-600');
        contentInput.focus();
        contentInput.selectionStart = contentInput.selectionEnd = contentInput.value.length;
    }
}