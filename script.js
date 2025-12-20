// Import the functions you need from the SDKs you need
import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, set, onValue, query, orderByKey, limitToFirst, orderByChild, limitToLast, update, off, runTransaction } from "https://esm.sh/firebase/database";

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
let activeThreadId = null; 

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

window.toggleMenu = function() {
    const dropdown = document.querySelector('.menu-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
};

// --- LOGICA DE COMENTARIOS Y VISTAS ---
window.openComments = function(threadId) {
    activeThreadId = threadId;
    const modal = document.getElementById('commentsModal');
    const list = document.getElementById('commentsList');
    const usernameInput = document.getElementById('usernameInput');

    const savedName = localStorage.getItem('chatUsername');
    if (savedName && usernameInput) {
        usernameInput.value = savedName;
    }

    list.innerHTML = '<p style="text-align:center;">Cargando...</p>';
    modal.style.display = "block";

    const threadViewRef = ref(db, `threads/${threadId}/views`);
    runTransaction(threadViewRef, (currentViews) => {
        return (currentViews || 0) + 1;
    });

    const commentsRef = ref(db, `threads/${threadId}/comments`);
    off(commentsRef);

    onValue(commentsRef, (snapshot) => {
        list.innerHTML = '';
        const data = snapshot.val();
        if (data) {
            Object.values(data).forEach(comment => {
                const item = document.createElement('div');
                item.classList.add('comment-item');
                const date = new Date(comment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const authorName = comment.username || 'Anónimo';
                item.innerHTML = `
                    <span class="comment-author">${authorName}:</span> 
                    <span class="comment-text">${comment.text}</span> 
                    <span class="comment-date">${date}</span>
                `;
                list.appendChild(item);
            });
            list.scrollTop = list.scrollHeight;
        } else {
            list.innerHTML = '<p style="text-align:center; color:#999;">No hay comentarios aún.</p>';
        }
    });
};

const commentForm = document.getElementById('commentForm');
if(commentForm) {
    commentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const input = document.getElementById('commentInput');
        const usernameInput = document.getElementById('usernameInput');
        
        const text = input.value.trim();
        const username = usernameInput.value.trim() || 'Anónimo';

        if (text && activeThreadId) {
            localStorage.setItem('chatUsername', username);
            const commentsRef = ref(db, `threads/${activeThreadId}/comments`);
            push(commentsRef, { 
                text: text, 
                username: username, 
                timestamp: Date.now(), 
                userId: getUserId() 
            });
            input.value = '';
        }
    });
}

// --- LÓGICA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', function () {
    updateCountdown();
    setInterval(updateCountdown, 1000);

    const newThreadButton = document.getElementById('newThreadButton');
    const newThreadModalContent = document.getElementById('newThreadModalContent');
    const newThreadForm = document.getElementById('newThreadForm');
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');
    const searchInput = document.getElementById('searchInput');

    function saveThreadToFirebase(thread) {
        thread.timestamp = Date.now();
        thread.displayDate = new Date().toLocaleDateString('es-ES');
        thread.likeCount = 0;
        thread.views = 0; 
        push(threadsRef, thread);
    }

    // --- FUNCIÓN DE FORMATO CORREGIDA (FORZANDO ELIMINACIÓN DE .0) ---
    function formatCount(count) {
        let num = Number(count);
        
        if (num >= 1000000) {
            // Convertimos a string con 1 decimal: "1.0", "1.5"
            let val = (num / 1000000).toFixed(0);
            // Si termina en .0, lo cortamos
            if (val.endsWith('.0')) {
                val = val.slice(0, -2); // Elimina los últimos 2 caracteres
            }
            return val + ' mill.';
        }
        
        if (num >= 1000) {
            // Convertimos a string con 1 decimal: "850.0", "850.5"
            let val = (num / 1000).toFixed(0);
            // Si termina en .0, lo cortamos
            if (val.endsWith('.0')) {
                val = val.slice(0, -2); // Elimina los últimos 2 caracteres
            }
            return val + ' mil';
        }
        
        return num;
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
                    
                    let rawCommentCount = thread.comments ? Object.keys(thread.comments).length : 0;
                    
                    let formattedLikeCount = formatCount(thread.likeCount || 0);
                    let formattedViewCount = formatCount(thread.views || 0);
                    let formattedCommentCount = formatCount(rawCommentCount);

                    newThread.innerHTML = `
                        <div class="thread-date">${thread.displayDate}</div>
                        <h2>${thread.title} ${insigniaVerificado}</h2>
                        <p><strong>Categoría:</strong> ${thread.category}</p>
                        <p>${thread.description}</p>
                        <div class="thread-actions">
                            <button class="like-button ${isLiked ? 'liked' : ''}" data-thread-id="${key}" data-like-count="${thread.likeCount || 0}">
                                <i class="fas fa-heart"></i> ${formattedLikeCount}
                            </button>
                            <button class="comment-button" onclick="openComments('${key}')">
                                <i class="far fa-comment"></i> ${formattedCommentCount}
                            </button>
                            <span class="view-button" title="Vistas">
                                <i class="far fa-eye"></i> ${formattedViewCount}
                            </span>
                        </div>
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