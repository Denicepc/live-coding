const token = getToken();

// LÓGICA DE SEGURIDAD
// Si estamos en el Dashboard y NO hay token, expulsa al usuario al login
if (!token || isTokenExpired(token)) {
    localStorage.removeItem("token");
    window.location.href = "../index.html";
} else {
    // Si la seguridad pasa, cargamos las notas
    fetchNotes();
}

// EVENTOS DEL DASHBOARD
const logoutBtn = document.getElementById("logout-btn");
const gestionBtn = document.getElementById("gestion-btn");
const createNoteBtn = document.getElementById("create-note-btn");

// CERRAR SESIÓN
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "../index.html"; // Redirigir al login
    });
}

// Gestión boton
if (gestionBtn) {
    gestionBtn.addEventListener("click", () => {
        window.location.href = "../admin/admin.html"; // Redirigir a la página de gestión
    });
}


// CREAR NOTA
if (createNoteBtn) {
    createNoteBtn.addEventListener("click", async () => {
        const titleInput = document.getElementById("new-note-title");
        const contentInput = document.getElementById("new-note-content");
        const errorMsg = document.getElementById("note-error");
        errorMsg.classList.add("hidden");

        if (!titleInput.value.trim()){
            errorMsg.textContent = "El título es obligatorio";   
            errorMsg.classList.remove("hidden"); 
            return;
        }

        try {
            const response = await fetch(`${API_URL}/notes`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({ title: escapeHTML(titleInput.value), content: escapeHTML(contentInput.value) })
            });

            if (response.ok) {
                titleInput.value = "";
                contentInput.value = "";
                fetchNotes();
            } else {
                const err = await response.json();
                errorMsg.textContent = err.error;
                errorMsg.classList.remove("hidden");
            }
        } catch (error) {
            console.error(error);
        }
    });
}

// ==========================================
// FUNCIONES GLOBALES PARA NOTAS (Llamadas desde el HTML renderizado)
// ==========================================

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
            window.location.href = "../index.html";
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
        noteDiv.className = `sticky-note bg-[${note.color || '#fef08a'}] p-6 h-64 relative rotate-1 flex flex-col`;
        
        noteDiv.innerHTML = `
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 pushpin">
                <div class="w-4 h-4 bg-red-600 rounded-full border-2 border-white/30"></div>
            </div>
            
            <input type="text" id="title-${note.id}" value="${escapeHTML(note.title)}" disabled
                class="form-input p-1 border-0 focus:ring-0 bg-transparent disabled:bg-transparent disabled:opacity-100 disabled:text-slate-900 font-bold text-xl mb-1 w-full transition-colors rounded">
            
            <textarea id="content-${note.id}" disabled
                class="form-textarea p-1 border-0 focus:ring-0 bg-transparent disabled:bg-transparent disabled:opacity-100 disabled:text-slate-900 font-handwritten text-lg flex-1 w-full resize-none transition-colors rounded">${escapeHTML(note.content)}</textarea>
            
            <div class="flex gap-2 justify-end mt-2">
                <button class="restore-note-btn bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors font-bold shadow-sm hidden" data-note-id="${note.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 20 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-restore"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3.06 13a9 9 0 1 0 .49 -4.087" /><path d="M3 4.001v5h5" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                    </svg>
                </button>
                <button class="edit-note-btn bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 transition-colors font-bold shadow-sm" data-note-id="${note.id}">
                    Editar
                </button>
                <button class="delete-note-btn bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-700 transition-colors font-bold shadow-sm" data-note-id="${note.id}">
                    Borrar
                </button>
            </div>
        `;
        container.appendChild(noteDiv);
        
        // Agregar event listeners de forma segura
        const restoreBtn = noteDiv.querySelector('.restore-note-btn');
        const editBtn = noteDiv.querySelector('.edit-note-btn');
        const deleteBtn = noteDiv.querySelector('.delete-note-btn');
        
        restoreBtn.addEventListener('click', () => restoreNote(note.id));
        editBtn.addEventListener('click', () => toggleEditMode(note.id));
        deleteBtn.addEventListener('click', () => deleteNote(note.id));
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
    const editBtn = document.querySelector(`.edit-note-btn[data-note-id="${noteId}"]`);
    const restoreBtn = document.querySelector(`.restore-note-btn[data-note-id="${noteId}"]`);

    const isEditing = !titleInput.disabled;

    if (isEditing) {
        // --- ESTAMOS GUARDANDO ---
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
                
                restoreBtn.classList.add("hidden");
            } else {
                const data = await response.json();
                alert("Error al editar: " + data.error);
            }
        } catch (error) {
            alert("Ocurrió un error al guardar los cambios.");
        }
    } else {
        // --- MODO EDICIÓN ---
        titleInput.dataset.original = titleInput.value;
        contentInput.dataset.original = contentInput.value;

        restoreBtn.classList.remove("hidden");

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

function restoreNote(noteId) {
    const titleInput = document.getElementById(`title-${noteId}`);
    const contentInput = document.getElementById(`content-${noteId}`);
    const editBtn = document.querySelector(`.edit-note-btn[data-note-id="${noteId}"]`);
    const restoreBtn = document.querySelector(`.restore-note-btn[data-note-id="${noteId}"]`);

    titleInput.value = titleInput.dataset.original || titleInput.value;
    contentInput.value = contentInput.dataset.original || contentInput.value;

    titleInput.disabled = true;
    contentInput.disabled = true;
    titleInput.classList.replace('bg-white/50', 'bg-transparent');
    contentInput.classList.replace('bg-white/50', 'bg-transparent');

    editBtn.textContent = "Editar";
    editBtn.classList.replace('bg-green-500', 'bg-orange-500');
    editBtn.classList.replace('hover:bg-green-600', 'hover:bg-orange-700');

    restoreBtn.classList.add("hidden");
}