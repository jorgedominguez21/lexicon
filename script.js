// script.js - Lexicon Studio Web Corregido (V2 - Con RAE/Wiki y Mejoras de Modal)
class PalabrasEngine {
    constructor() {
        this.supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        this.words = [];
        this.loading = false;
        this.loadWords();
    }

    async loadWords() {
        this.loading = true;
        try {
            const { data, error } = await this.supabase.from('palabras').select('*').order('termino');
            if (error) throw error;
            this.words = data || [];
        } catch (e) { console.error(e); }
        this.loading = false;
        updateStats();
        updateLista();
    }

    async listarRapido(filtro = '') {
        const query = filtro.toLowerCase();
        return this.words.filter(w => w.termino.toLowerCase().includes(query)).slice(0, 50);
    }

    getCategorias() {
        return { 
            'sust': 'Sustantivo', 
            'adj': 'Adjetivo', 
            'verb': 'Verbo', 
            'adv': 'Adverbio',
            'expr': 'Expresión'
        };
    }
}

const engine = new PalabrasEngine();

// --- UI CONTROL ---
document.addEventListener('DOMContentLoaded', initUI);

function initUI() {
    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.id.replace('btn-', '');
            switchSection(section);
        });
    });

    // Menú Móvil
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    }

    // Buscador con retraso para rendimiento
    const inputBusqueda = document.getElementById('busqueda');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', () => {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(updateLista, 300);
        });
    }

    document.getElementById('btn-cancel').onclick = () => {
        document.getElementById('modal-edit').classList.remove('active');
    };

    switchSection('dashboard');
}

function switchSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const targetSection = document.getElementById(id);
    const targetBtn = document.getElementById('btn-' + id);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    document.getElementById('sidebar').classList.remove('active'); 

    if (id === 'juego') initJuego();
}

async function updateStats() {
    const el = document.getElementById('stats-total');
    if (el) el.textContent = `Total palabras en base de datos: ${engine.words.length}`;
}

async function updateLista() {
    const lista = document.getElementById('lista-palabras');
    const busqueda = document.getElementById('busqueda').value;
    const palabras = await engine.listarRapido(busqueda);
    const catsMap = engine.getCategorias();
    
    lista.innerHTML = '';
    palabras.forEach(p => {
        const card = document.createElement('div');
        card.className = 'palabra-card';
        
        // Mapeo de categoría para mostrar nombre completo
        const categoriaNombre = catsMap[p.tipo] || p.tipo;

        // Abrir modal al hacer clic en la tarjeta
        card.onclick = () => {
            document.getElementById('modal-title').textContent = p.termino.toUpperCase();
            document.getElementById('input-word').value = p.termino;
            document.getElementById('input-cat').value = p.tipo;
            document.getElementById('input-def').value = p.definicion;
            document.getElementById('modal-edit').classList.add('active');
        };

        card.innerHTML = `
            <div class="palabra-titulo">${p.termino.toUpperCase()}</div>
            <span class="palabra-cat">${categoriaNombre}</span>
            <div class="card-links">
                <a href="https://dle.rae.es/${p.termino}" target="_blank" onclick="event.stopPropagation();">RAE</a>
                <a href="https://es.wiktionary.org/wiki/${p.termino}" target="_blank" onclick="event.stopPropagation();">WIKI</a>
            </div>
        `;
        lista.appendChild(card);
    });
}

// --- JUEGO AHORCADO ---
let gameState = { palabra: '', fallos: 0, adivinadas: [] };

async function initJuego() {
    if (engine.words.length === 0) return;
    const item = engine.words[Math.floor(Math.random() * engine.words.length)];
    gameState = {
        palabra: item.termino.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        pista: item.definicion,
        fallos: 0,
        adivinadas: []
    };
    
    document.getElementById('game-hint').textContent = 'Pista: ' + gameState.pista;
    document.getElementById('game-overlay').classList.remove('active');
    renderJuego();
    dibujarAhorcado(0);
}

function renderJuego() {
    const display = document.getElementById('palabra-mostrada');
    display.textContent = gameState.palabra.split('').map(l => gameState.adivinadas.includes(l) ? l : '_').join(' ');
    
    const teclado = document.getElementById('teclado');
    teclado.innerHTML = '';
    'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').forEach(l => {
        const btn = document.createElement('button');
        btn.className = 'tecla';
        btn.textContent = l;
        btn.disabled = gameState.adivinadas.includes(l);
        btn.onclick = () => procesarLetra(l);
        teclado.appendChild(btn);
    });
}

function procesarLetra(l) {
    if (gameState.palabra.includes(l)) {
        gameState.adivinadas.push(l);
    } else {
        gameState.fallos++;
        dibujarAhorcado(gameState.fallos);
    }
    
    renderJuego();
    
    if (gameState.fallos >= 6) finalizarJuego(false);
    else if (gameState.palabra.split('').every(l => gameState.adivinadas.includes(l))) finalizarJuego(true);
}

function finalizarJuego(gana) {
    document.getElementById('overlay-msg').textContent = gana ? '¡GANASTE!' : '¡PERDISTE!';
    document.getElementById('palabra-final').textContent = 'La palabra era: ' + gameState.palabra;
    document.getElementById('game-overlay').classList.add('active');
}

function dibujarAhorcado(paso) {
    const canvas = document.getElementById('canvas-ahorcado');
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1f538d';

    if (paso === 0) {
        ctx.clearRect(0, 0, 300, 300);
        ctx.beginPath();
        ctx.moveTo(50, 250); ctx.lineTo(250, 250); // Base
        ctx.moveTo(100, 250); ctx.lineTo(100, 50); // Poste
        ctx.moveTo(100, 50); ctx.lineTo(200, 50);  // Techo
        ctx.moveTo(200, 50); ctx.lineTo(200, 80);  // Cuerda
        ctx.stroke();
        return;
    }

    ctx.beginPath();
    switch(paso) {
        case 1: ctx.arc(200, 105, 25, 0, Math.PI * 2); break; // Cabeza
        case 2: ctx.moveTo(200, 130); ctx.lineTo(200, 200); break; // Cuerpo
        case 3: ctx.moveTo(200, 140); ctx.lineTo(170, 170); break; // Brazo izq
        case 4: ctx.moveTo(200, 140); ctx.lineTo(230, 170); break; // Brazo der
        case 5: ctx.moveTo(200, 200); ctx.lineTo(170, 240); break; // Pierna izq
        case 6: ctx.moveTo(200, 200); ctx.lineTo(230, 240); break; // Pierna der
    }
    ctx.stroke();
}