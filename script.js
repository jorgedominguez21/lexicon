// script.js - Lexicon Studio Web V3.0 (Edición Estudio & Sincronización)
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
        const normalizar = (texto) => 
            texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const query = normalizar(filtro);
        
        return this.words.filter(w => {
            const terminoSinAcentos = normalizar(w.termino);
            return terminoSinAcentos.includes(query);
        }).slice(0, 50);
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
let palabraActualEstudio = null;

// --- UI CONTROL ---
document.addEventListener('DOMContentLoaded', initUI);

function initUI() {
    // Navegación General
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

    // Buscador con retraso
    const inputBusqueda = document.getElementById('busqueda');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', () => {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(updateLista, 300);
        });
    }

    // Cerrar Modal
    const btnCancel = document.getElementById('btn-cancel');
    if (btnCancel) {
        btnCancel.onclick = () => {
            document.getElementById('modal-edit').classList.remove('active');
        };
    }

    // --- EVENTOS MODO ESTUDIO ---
    const btnEstudioMenu = document.getElementById('btn-estudio');
    if (btnEstudioMenu) {
        btnEstudioMenu.onclick = () => {
            switchSection('estudio');
            cargarNuevaPalabraEstudio();
        };
    }

    const btnComprobar = document.getElementById('btn-comprobar');
    if (btnComprobar) {
        btnComprobar.onclick = comprobarRespuesta;
    }

    const inputRespuesta = document.getElementById('input-respuesta');
    if (inputRespuesta) {
        inputRespuesta.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') comprobarRespuesta();
        });
    }

    // Cargar última sección visitada o Dashboard por defecto
    const ultimaSeccion = localStorage.getItem('seccionActiva') || 'dashboard';
    switchSection(ultimaSeccion);
    
    // Si la última sección era estudio, cargar palabra automáticamente
    if (ultimaSeccion === 'estudio') cargarNuevaPalabraEstudio();
}

function switchSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const targetSection = document.getElementById(id);
    const targetBtn = document.getElementById('btn-' + id);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('active'); 

    localStorage.setItem('seccionActiva', id);

    if (id === 'juego') initJuego();
    if (id === 'estudio') cargarNuevaPalabraEstudio();
}

async function updateStats() {
    const el = document.getElementById('stats-total');
    if (el) el.textContent = `Total palabras en base de datos: ${engine.words.length}`;
}

async function updateLista() {
    const lista = document.getElementById('lista-palabras');
    if (!lista) return;
    
    const busquedaInput = document.getElementById('busqueda');
    const busqueda = busquedaInput ? busquedaInput.value : '';
    const palabras = await engine.listarRapido(busqueda);
    const catsMap = engine.getCategorias();
    
    lista.innerHTML = '';
    palabras.forEach(p => {
        const card = document.createElement('div');
        card.className = 'palabra-card';
        
        const categoriaNombre = catsMap[p.tipo] || p.tipo;

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
                <a href="https://dle.rae.es/${p.termino}" target="_blank" class="link-ext" onclick="event.stopPropagation();">RAE</a>
                <a href="https://es.wiktionary.org/wiki/${p.termino}" target="_blank" class="link-ext" onclick="event.stopPropagation();">WIKI</a>
                <span class="link-lexicon">📖 Definición</span>
            </div>
        `;
        lista.appendChild(card);
    });
}

// --- MODO ESTUDIO (ALGORITMO DE NIVELES) ---
async function cargarNuevaPalabraEstudio() {
    const feedback = document.getElementById('feedback-estudio');
    const input = document.getElementById('input-respuesta');
    if (feedback) feedback.textContent = '';
    if (input) {
        input.value = '';
        input.style.borderColor = '#ddd';
        input.focus();
    }

    // Traemos 10 candidatas con nivel más bajo
    const { data, error } = await engine.supabase
        .from('palabras')
        .select('*')
        .order('nivel', { ascending: true })
        .limit(10);

    if (data && data.length > 0) {
        // Elegimos una al azar de esas 10
        palabraActualEstudio = data[Math.floor(Math.random() * data.length)];
        document.getElementById('pista-definicion').textContent = `"${palabraActualEstudio.definicion}"`;
    } else {
        document.getElementById('pista-definicion').textContent = "No hay palabras para estudiar.";
    }
}

async function comprobarRespuesta() {
    const input = document.getElementById('input-respuesta');
    const feedback = document.getElementById('feedback-estudio');
    const respuesta = input.value.trim();

    if (!palabraActualEstudio) return;

    // Comparación estricta (puedes añadir .toLowerCase() si prefieres flexibilidad)
    if (respuesta === palabraActualEstudio.termino) {
        feedback.innerHTML = '<span style="color: #27ae60;">✅ ¡Perfecto! Nivel subido.</span>';
        input.style.borderColor = '#27ae60';
        
        await engine.supabase
            .from('palabras')
            .update({ nivel: (palabraActualEstudio.nivel || 0) + 1 })
            .eq('id', palabraActualEstudio.id);

        setTimeout(cargarNuevaPalabraEstudio, 1200);
    } else {
        feedback.innerHTML = `<span style="color: #e74c3c;">❌ Error. Era: ${palabraActualEstudio.termino}</span>`;
        input.style.borderColor = '#e74c3c';
        
        await engine.supabase
            .from('palabras')
            .update({ nivel: 0 })
            .eq('id', palabraActualEstudio.id);
            
        setTimeout(cargarNuevaPalabraEstudio, 2500);
    }
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
    if (!display) return;
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1f538d';

    if (paso === 0) {
        ctx.clearRect(0, 0, 300, 300);
        ctx.beginPath();
        ctx.moveTo(50, 250); ctx.lineTo(250, 250); 
        ctx.moveTo(100, 250); ctx.lineTo(100, 50); 
        ctx.moveTo(100, 50); ctx.lineTo(200, 50);  
        ctx.moveTo(200, 50); ctx.lineTo(200, 80);  
        ctx.stroke();
        return;
    }

    ctx.beginPath();
    switch(paso) {
        case 1: ctx.arc(200, 105, 25, 0, Math.PI * 2); break; 
        case 2: ctx.moveTo(200, 130); ctx.lineTo(200, 200); break; 
        case 3: ctx.moveTo(200, 140); ctx.lineTo(170, 170); break; 
        case 4: ctx.moveTo(200, 140); ctx.lineTo(230, 170); break; 
        case 5: ctx.moveTo(200, 200); ctx.lineTo(170, 240); break; 
        case 6: ctx.moveTo(200, 200); ctx.lineTo(230, 240); break; 
    }
    ctx.stroke();
}