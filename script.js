document.addEventListener('DOMContentLoaded', function() {
 const newThreadButton = document.getElementById('newThreadButton');
 const newThreadModalContent = document.getElementById('newThreadModalContent');
 const closeButton = document.querySelector('.close-button');
 const newThreadForm = document.getElementById('newThreadForm');
 const threadContainer = document.querySelector('.thread-container');
 const noThreadsMessage = document.getElementById('noThreadsMessage');

 // Abre/cierra el modal al hacer clic en el botón "+ Nuevo"
 newThreadButton.addEventListener('click', function(event) {
 newThreadModalContent.style.display = newThreadModalContent.style.display === 'block' ? 'none' : 'block';
 });

 // Cierra el modal al hacer clic en la "x"
 closeButton.addEventListener('click', function() {
 newThreadModalContent.style.display = 'none';
 });

 // Envía el formulario para crear un nuevo hilo
 newThreadForm.addEventListener('submit', function(event) {
 event.preventDefault();

 const category = document.getElementById('category').value;
 const title = document.getElementById('title').value;
 const description = document.getElementById('description').value;

 // Crea un nuevo hilo
 const newThread = document.createElement('div');
 newThread.classList.add('thread');
 newThread.innerHTML = `
 <h2>${title}</h2>
 <p><strong>Categoría:</strong> ${category}</p>
 <p>${description}</p>
 `;

 // Agrega el nuevo hilo al contenedor
 threadContainer.appendChild(newThread);

 // Oculta el mensaje "No hay hilos aún"
 noThreadsMessage.style.display = 'none';

 // Cierra el modal
 newThreadModalContent.style.display = 'none';

 // Limpia el formulario
 newThreadForm.reset();
 });
});