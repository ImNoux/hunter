// Import the functions you need from the SDKs you need
import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, set, onValue, query, orderByKey, limitToFirst, orderByChild, limitToLast, update } from "https://esm.sh/firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyDM9E8Y_YW-ld8MH8-yKS345hklA0v5P_w",
    authDomain: "hunterteam.firebaseapp.com",
    databaseURL: "https://hunterteam-default-rtdb.firebaseio.com",
    projectId: "hunterteam",
    storageBucket: "hunterteam.firebasestorage.app",
    messagingSenderId: "1001713111500",
    appId: "1:1001713111500:web:8729bf9a47a7806f6c4d69",
    measurementId: "G-W6E0YQ8PEJ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const threadsRef = ref(db, 'threads'); 

const threadsPerPage = 5; 
let currentPage = 1; 
let totalThreads = 0; 
let searchTerm = ''; 

// --- FUNCIONES DE UTILIDAD ---
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

function updateCountdown() {
    const now = new Date().getTime();
    const christmas = new Date('December 25, 2025 00:00:00').getTime();
    const difference = christmas - now;

    if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        document.getElementById('countdown').innerHTML = `Faltan ${days} días, ${hours} horas ${minutes} minutos y ${seconds} segundos para Navidad`;
    } else {
        document.getElementById('countdown').innerHTML = '¡Feliz Navidad!';
    }
}

// --- MENÚ Y POPUPS ---
window.toggleMenu = function() {
    const dropdown = document.querySelector('.menu-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

window.addEventListener('click', function(event) {
    if (!event.target.matches('.menu-btn') && !event.target.closest('.menu-container')) {
        const dropdowns = document.getElementsByClassName("menu-dropdown");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
});

// Función SIN NIEVE
window.openInfoPage = function(type) {
    let title = "";
    let content = "";
    
    if (type === 'updates') {
        title = "Actualizaciones";
        content = "<h3>v1.1.0</h3><ul><li>Menú desplegable mejorado.</li><li>Optimización de carga.</li></ul>";
    } else if (type === 'about') {
        title = "Quiénes Somos";
        content = "<h3>ARC_CLXN</h3><p>Somos un clan enfocado en la excelencia y el reclutamiento de los mejores usuarios.</p>";
    } else if (type === 'contact') {
        title = "Contactos";
        content = "<h3>Contacto Directo</h3><p>Instagram: @arc_clxn</p>";
    }

    const newWindow = window.open("", "_blank", "width=600,height=500");
    newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { 
                    font-family: Arial; padding: 40px; background: linear-gradient(to bottom, #0f4c75, #3282b8); 
                    color: white; text-align: center; margin: 0;
                }
                .box { 
                    background: rgba(255, 255, 255, 0.95); color: #333; padding: 20px; 
                    border-radius: 10px; border: 3px solid #d32f2f;
                }
                h2 { color: #d32f2f; }
                button { background: #ffeb3b; border: none; padding: 10px 20px; cursor: pointer; font-weight: bold; margin-top: 20px; border-radius: 5px; }
                button:hover { background-color: #fdd835; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>${title}</h2>
                <div>${content}</div>
                <button onclick="window.close()">Cerrar Ventana</button>
            </div>
        </body>
        </html>
    `);
};

// --- LÓGICA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', function () {
    updateCountdown();
    setInterval(updateCountdown, 1000);

    // (Código de audio eliminado)

    const newThreadButton = document.getElementById('newThreadButton');
    const newThreadModalContent = document.getElementById('newThreadModalContent');
    const closeButton = document.querySelector('.close-button');
    const newThreadForm = document.getElementById('newThreadForm');
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');
    const searchInput = document.getElementById('searchInput');

    function saveThreadToFirebase(thread) {
        thread.timestamp = Date.now();
        thread.displayDate = new Date().toLocaleDateString('es-ES');
        thread.likeCount = 0;
        thread.likes = {};
        thread.verificado = false;
        push(threadsRef, thread);
    }

    function formatLikeCount(likeCount) {
        if (likeCount >= 1000000) return (likeCount / 1000000).toFixed(1) + ' mill.';
        if (likeCount >= 1000) return (likeCount / 1000).toFixed(0) + ' mil';
        return likeCount;
    }

    function loadThreadsFromFirebase(page, searchTerm = '') {
        const firstThreadIndex = (page - 1) * threadsPerPage;
        const getThreads = query(threadsRef, orderByChild('timestamp'));

        onValue(getThreads, (snapshot) => {
            threadContainer.innerHTML = '';
            let threads = snapshot.val();
            if (threads) {
                let allThreads = Object.entries(threads).sort((a, b) => b[1].timestamp - a[1].timestamp);
                let filteredThreads = allThreads.filter(([key, thread]) =>
                    thread.title.toLowerCase().includes(searchTerm.toLowerCase())
                );
                totalThreads = filteredThreads.length;

                for (let i = firstThreadIndex; i < firstThreadIndex + threadsPerPage && i < filteredThreads.length; i++) {
                    let [key, thread] = filteredThreads[i];
                    let newThread = document.createElement('div');
                    newThread.classList.add('thread');
                    const userId = getUserId();
                    let isLiked = thread.likes && thread.likes[userId];
                    let insigniaVerificado = thread.verificado ? '<i class="fas fa-check-circle insignia-verificado"></i>' : '';
                    let formattedLikeCount = formatLikeCount(thread.likeCount || 0);
                    
                    newThread.innerHTML = `
                        <div class="thread-date">${thread.displayDate}</div>
                        <h2>${thread.title} ${insigniaVerificado}</h2>
                        <p><strong>Categoría:</strong> ${thread.category}</p>
                        <p>${thread.description}</p>
                        <button class="like-button ${isLiked ? 'liked' : ''}" data-thread-id="${key}" data-like-count="${thread.likeCount || 0}">
                          <i class="fas fa-heart"></i> ${formattedLikeCount}
                        </button>
                    `;
                    threadContainer.appendChild(newThread);
                }

                if (filteredThreads.length === 0) {
                    noThreadsMessage.style.display = 'block';
                    threadContainer.appendChild(noThreadsMessage);
                } else {
                    noThreadsMessage.style.display = 'none';
                }
            } else {
                noThreadsMessage.style.display = 'block';
                threadContainer.appendChild(noThreadsMessage);
                totalThreads = 0;
            }
            createPaginationButtons(totalThreads, searchTerm);
            
            document.querySelectorAll('.like-button').forEach(button => {
                button.onclick = function() {
                    const threadId = this.dataset.threadId;
                    const userId = getUserId();
                    const liked = this.classList.contains('liked');
                    const currentCount = parseInt(this.dataset.likeCount);
                    const newCount = liked ? currentCount - 1 : currentCount + 1;
                    const updates = {};
                    updates[`/threads/${threadId}/likeCount`] = newCount;
                    updates[`/threads/${threadId}/likes/${userId}`] = liked ? null : true;
                    update(ref(db), updates);
                };
            });
        });
    }

    function createPaginationButtons(totalThreads, searchTerm = '') {
        paginationContainer.innerHTML = '';
        const totalPages = Math.ceil(totalThreads / threadsPerPage);

        const prevButton = document.createElement('button');
        prevButton.textContent = '« Anterior';
        prevButton.classList.add('pagination-button');
        prevButton.disabled = (currentPage === 1);
        prevButton.onclick = () => { if (currentPage > 1) { currentPage--; loadThreadsFromFirebase(currentPage, searchTerm); } };
        paginationContainer.appendChild(prevButton);

        for (let i = 1; i <= totalPages; i++) {
            let pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.classList.add('pagination-button');
            if (i === currentPage) pageButton.classList.add('active-page');
            pageButton.onclick = () => { currentPage = i; loadThreadsFromFirebase(currentPage, searchTerm); };
            paginationContainer.appendChild(pageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Siguiente »';
        nextButton.classList.add('pagination-button');
        nextButton.disabled = (currentPage === totalPages || totalPages === 0);
        nextButton.onclick = () => { if (currentPage < totalPages) { currentPage++; loadThreadsFromFirebase(currentPage, searchTerm); } };
        paginationContainer.appendChild(nextButton);
    }

    loadThreadsFromFirebase(currentPage, searchTerm);

    if(newThreadButton) {
        newThreadButton.onclick = () => {
            newThreadModalContent.style.display = (newThreadModalContent.style.display === 'none') ? 'block' : 'none';
        };
    }

    if(closeButton) {
        closeButton.onclick = () => { newThreadModalContent.style.display = 'none'; };
    }

    if(newThreadForm) {
        newThreadForm.onsubmit = (event) => {
            event.preventDefault();
            let thread = {
                title: document.getElementById('title').value,
                category: document.getElementById('category').value,
                description: document.getElementById('description').value
            };
            saveThreadToFirebase(thread);
            newThreadModalContent.style.display = 'none';
            newThreadForm.reset();
            loadThreadsFromFirebase(currentPage, searchTerm);
        };
    }

    if(searchInput) {
        searchInput.oninput = (event) => {
            searchTerm = event.target.value;
            currentPage = 1;
            loadThreadsFromFirebase(currentPage, searchTerm);
        };
    }
});