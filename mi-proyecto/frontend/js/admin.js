const token = localStorage.getItem("token");
let currentUserRole = "user"; 
let currentUserId = null;

// 1. LÓGICA DE SEGURIDAD Y PROTECCIÓN DE RUTAS
async function initAdminPanel() {
    if (!token || isTokenExpired(token)) {
        window.location.href = "../index.html";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            currentUserRole = data.user.role;
            currentUserId = data.user.id;

            // Si es un usuario normal, no tiene nada que hacer aquí
            if (currentUserRole === "user") {
                window.location.href = "../dashboard/dashboard.html";
                return;
            }

            document.getElementById("user-role-badge").textContent = `Rol: ${currentUserRole.toUpperCase()}`;
            
            // Cargar datos del panel
            fetchUsersList();
            fetchAllNotes(); // muestra todas las notas
            
            // Solo el Admin puede ver estadísticas globales según tu API
            if (currentUserRole === "admin" || currentUserRole === "gestor") {
                document.getElementById("stats-section").classList.remove("hidden");
                fetchStats();
            }
        } else {
            window.location.href = "../index.html";
        }
    } catch (error) {
        console.error("Error validando sesión:", error);
    }
}

// 2. OBTENER LISTADO DE USUARIOS Y NOTAS
async function fetchUsersList() {
    try {
        const response = await fetch(`${API_URL}/admin/users-with-notes`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            renderUsersTable(data.users);
        } else {
            alert("No tienes permiso para ver los usuarios.");
        }
    } catch (error) {
        console.error(error);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById("users-table-body");
    tbody.innerHTML = "";

    users.forEach(user => {
        // Lógica de "Si no ha escrito sale que no"
        const notesDisplay = user.note_count > 0 
            ? `<span class="bg-green-100 text-green-800 font-bold px-2 py-1 rounded-full text-xs">${user.note_count} notas</span>`
            : `<span class="text-gray-400 italic">No ha escrito notas</span>`;

        // Solo admin puede cambiar roles, y no puede cambiarse a sí mismo
        const isSelf = user.id === currentUserId;
        const canChangeRole = currentUserRole === "admin" && !isSelf;
        
        // Select de roles
        const roleSelect = canChangeRole ? `
            <select onchange="changeRole('${user.id}', this.value)" class="border rounded p-1 text-sm bg-white">
                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                <option value="gestor" ${user.role === 'gestor' ? 'selected' : ''}>Gestor</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        ` : `<span class="capitalize font-medium text-slate-700">${user.role}</span>`;

        // Botones de acción (ver notas, asignar nota o borrar usuario)
        const btnViewNotes = `<button onclick="fetchUserSpecificNotes('${user.id}', '${escapeHTML(user.username)}')" class="bg-emerald-500 text-white px-3 py-1 rounded text-xs hover:bg-emerald-600 font-bold mr-2">Ver Notas</button>`;
        const btnAssign = `<button onclick="openAssignModal('${user.id}')" class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 font-bold">Asignar Nota</button>`;
        const btnDelete = (currentUserRole === "admin" && !isSelf) 
            ? `<button onclick="deleteUser('${user.id}', '${escapeHTML(user.username)}')" class="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 font-bold ml-2">Borrar</button>` 
            : '';

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="p-4 font-bold text-slate-800">${escapeHTML(user.username)}</td>
            <td class="p-4 text-gray-600">${escapeHTML(user.email)}</td>
            <td class="p-4">${roleSelect}</td>
            <td class="p-4">${notesDisplay}</td>
            <td class="p-4">${btnViewNotes} ${btnAssign} ${btnDelete}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. CAMBIAR ROL (Solo Admin)
async function changeRole(userId, newRole) {
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ role: newRole })
        });
        
        const data = await response.json();
        if (!response.ok) alert(data.error);
    } catch (error) {
        console.error("Error al cambiar rol:", error);
    }
}

// 4. BORRAR USUARIO (Solo Admin)
async function deleteUser(userId) {
    if (!confirm("¿Seguro que quieres borrar este usuario y TODAS sus notas?")) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.ok) {
            fetchUsersList(); // Recargar tabla
            if(currentUserRole === "admin") fetchStats(); // Recargar stats
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error(error);
    }
}

// 5. ASIGNAR NOTAS (Admin y Gestor)
const modal = document.getElementById("assign-modal");

// El botón puede pasar el nombre del usuario para el título del modal
function openAssignModal(targetUserId, targetUsername) {
    const userIdInput = document.getElementById("assign-target-user-id");
    const modalTitle = document.getElementById("modal-title");
    const noteIdInput = document.getElementById("assign-note-id");

    if (userIdInput) userIdInput.value = targetUserId;
    if (modalTitle) modalTitle.textContent = `Asignar nota a ${targetUsername || 'usuario'}`;
    if (noteIdInput) noteIdInput.value = "";
    
    modal.classList.remove("hidden");
}

document.getElementById("close-modal-btn").addEventListener("click", () => {
    modal.classList.add("hidden");
});

document.getElementById("confirm-assign-btn").addEventListener("click", async () => {
    const targetUserId = document.getElementById("assign-target-user-id").value;
    const noteId = document.getElementById("assign-note-id").value.trim();

    if (!noteId) return alert("Debes introducir el ID de una nota.");

    try {
        const response = await fetch(`${API_URL}/admin/notes/${noteId}/assign`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ target_user_id: targetUserId })
        });

        const data = await response.json();
        if (response.ok) {
            alert("¡Nota asignada correctamente!");
            modal.classList.add("hidden");
            fetchUsersList(); // Actualizamos el conteo visual
            if(currentUserRole === "admin") fetchStats();
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) {
        console.error(error);
    }
});

// 6. ESTADÍSTICAS (Solo Admin o gestor)
async function fetchStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById("stat-users").textContent = data.stats.total_users;
            document.getElementById("stat-notes").textContent = data.stats.total_notes;
            document.getElementById("stat-public").textContent = data.stats.public_notes;
        }
    } catch (error) {
        console.error(error);
    }
}

// 7. OBTENER TODAS LAS NOTAS (Solo Admin o gestor)
async function fetchAllNotes() {
    try {
        const response = await fetch(`${API_URL}/notes`, { // Asegúrate que esta ruta exista en tu backend
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            renderAllNotesTable(data.notes);
        }
    } catch (error) { console.error("Error cargando notas globales:", error); }
}

function renderAllNotesTable(notes) {
    const tbody = document.getElementById("all-notes-table-body");
    tbody.innerHTML = "";

    if (notes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500 italic">Este usuario no tiene notas visibles para tu rol.</td></tr>`;
        return;
    }

    notes.forEach(note => {
        const isAdmin = currentUserRole === "admin";
        
        // El Admin puede editar y borrar. El Gestor (o cualquier otro) solo editar.
        const btnEdit = `<button onclick="editNoteAdmin('${note.id}')" class="bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600 transition-colors text-xs font-bold">Editar</button>`;
        
        const btnDelete = isAdmin 
            ? `<button onclick="deleteNoteAdmin('${note.id}')" class="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors text-xs font-bold">Borrar</button>` 
            : `<span class="text-gray-400 text-xs italic">Sin permiso borrar</span>`;

        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-100 hover:bg-gray-50 transition-colors";
        tr.innerHTML = `
            <td class="p-4 font-mono text-[10px] text-blue-600">${note.id}</td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="font-bold text-slate-700">${escapeHTML(note.title)}</span>
                    ${note.is_public ? '<span class="text-[9px] text-green-600 font-bold">PÚBLICA</span>' : '<span class="text-[9px] text-red-600 font-bold">PRIVADA</span>'}
                </div>
            </td>
            <td class="p-4 text-gray-600 font-medium">${escapeHTML(note.content || 'Usuario')}</td>
            <td class="p-4 text-gray-600 font-medium">${escapeHTML(note.username || 'Usuario')}</td>
            <td class="p-4 flex gap-2">
                ${btnEdit}
                ${btnDelete}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Función para borrar nota desde el panel admin (Solo Admin)
async function deleteNoteAdmin(noteId) {
    if (currentUserRole !== "admin") return alert("No tienes permisos.");
    if (!confirm("¿Eliminar esta nota permanentemente?")) return;

    try {
        const response = await fetch(`${API_URL}/notes/${noteId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) fetchAllNotes();
    } catch (error) { console.error(error); }
}

//editar notas
async function editNoteAdmin(noteId) {
    const newTitle = prompt("Nuevo título de la nota:");
    if (newTitle === null) return; // Cancelado

    const newContent = prompt("Nuevo contenido:");
    if (newContent === null) return;

    try {
        const response = await fetch(`${API_URL}/notes/${noteId}`, { // Asegúrate de tener esta ruta en tu backend admin
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ title: newTitle, content: newContent })
        });

        if (response.ok) {
            alert("Nota actualizada correctamente");
            fetchAllNotes(); // Recargar tabla
        } else {
            const err = await response.json();
            alert("Error: " + err.error);
        }
    } catch (error) {
        console.error(error);
    }
}

async function fetchUserSpecificNotes(userId, username) {
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/notes`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            
            // 1. Actualizamos el título con el nombre del usuario
            document.getElementById("user-notes-title").textContent = `Notas de: ${username}`;
            
            // 2. Renderizamos las notas en la tabla
            renderAllNotesTable(data.notes);
            
            // 3. QUITAMOS la clase 'hidden' para que la sección aparezca
            const notesSection = document.getElementById("user-notes-section");
            notesSection.classList.remove("hidden");
            
            // 4. Hacemos scroll suave hasta la tabla para mejorar la UX
            notesSection.scrollIntoView({ behavior: 'smooth' });
            
        } else {
            alert("No se pudieron cargar las notas de este usuario.");
        }
    } catch (error) {
        console.error("Error al obtener notas:", error);
    }
}

// Logout
document.getElementById("logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "../index.html";
});

// Inicializar
initAdminPanel();