// 1. Obtener el token de la URL (?token=XXXX)
async function loadSharedNote() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        document.getElementById('error-message').classList.remove('hidden');
        return;
    }

    try {
        // 2. Llamar a tu API
        const response = await fetch(`${API_URL}/shared/${token}`);
                
        if (response.ok) {
            const data = await response.json();
            renderNote(data.note);
        } else {
            document.getElementById('error-message').classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

function renderNote(note) {
    const container = document.getElementById('shared-note-container');
    container.innerHTML = `
        <div class="bg-[${note.color || '#fef08a'}] p-8 shadow-xl rotate-1 relative h-80 flex flex-col">
            <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                <div class="w-5 h-5 bg-red-600 rounded-full border-2 border-white/30 shadow"></div>
            </div>
            <h1 class="text-2xl font-bold mb-4">${note.title}</h1>
            <p class="font-handwritten text-xl flex-1 overflow-y-auto">${note.content}</p>
            <div class="mt-4 text-xs text-black/40 font-bold">
                Creada el: ${new Date(note.created_at).toLocaleDateString()}
            </div>
        </div>
    `;
    container.classList.remove('hidden');
}

loadSharedNote();