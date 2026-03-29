// script.js - Lexicon Studio Web V3.3 (Modo Estudio - Pista sin acento)
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
        } catch (e) { console.error("Error inicializando datos:", e); }
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
        return { 'sust': 'Sustantivo', 'adj': 'Adjetivo', 'verb': 'Verbo', 'adv': 'Adverbio', 'expr': 'Expresión' };
    }
}

const engine = new PalabrasEngine();
let palabraActualEstudio = null;

document.addEventListener('DOMContentLoaded', initUI);

function initUI() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.id.replace('btn-', '');
            switchSection(section);
        });
    });

    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    }

    const inputBusqueda = document.getElementById('busqueda');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', () => {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(updateLista, 300);
        });
    }

    const btnCancel = document.getElementById('btn-cancel');
    if (btnCancel) btnCancel.onclick = () => document.getElementById('modal-edit').classList.remove('active');

    const btnEstudioMenu = document.getElementById('btn-estudio');
    if (btnEstudioMenu) {
        btnEstudioMenu.onclick = () => {
            switchSection('estudio');
            cargarNuevaPalabraEstudio();
        };
    }

    const btnComprobar = document.getElementById('btn-comprobar');
    if (btnComprobar) btnComprobar.onclick = comprobarRespuesta;

    const inputRespuesta = document.getElementById('input-respuesta');
    if (inputRespuesta) {
        inputRespuesta.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') comprobarRespuesta();
        });
    }

    const ultimaSeccion = localStorage.getItem('seccionActiva') || 'dashboard';
    switchSection(ultimaSeccion);
}

function switchSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const targetSection = document.getElementById(id);
    const targetBtn = document.getElementById('btn-' + id);
    if (targetSection) targetSection.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    if (document.getElementById('sidebar')) document.getElementById('sidebar').classList.remove('active'); 
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
    const busqueda = document.getElementById('busqueda').value;
    const palabras = await engine.listarRapido(busqueda);
    const catsMap = engine.getCategorias();
    lista.innerHTML = '';
    palabras.forEach(p => {
        const card = document.createElement('div');
        card.className = 'palabra-card';
        card.onclick = () => {
            document.getElementById('modal-title').textContent = p.termino.toUpperCase();
            document.getElementById('input-word').value = p.termino;
            document.getElementById('input-cat').value = p.tipo;
            document.getElementById('input-def').value = p.definicion;
            document.getElementById('modal-edit').classList.add('active');
        };
        card.innerHTML = `
            <div class="palabra-titulo">${p.termino.toUpperCase()}</div>
            <span class="palabra-cat">${catsMap[p.tipo] || p.tipo}</span>
            <div class="card-links">
                <a href="https://dle.rae.es/${p.termino}" target="_blank" class="link-ext" onclick="event.stopPropagation();">RAE</a>
                <span class="link-lexicon">📖 Definición</span>
            </div>
        `;
        lista.appendChild(card);
    });
}

// --- MODO ESTUDIO (LÓGICA CON PISTA SIN ACENTO) ---
async function cargarNuevaPalabraEstudio() {
    const feedback = document.getElementById('feedback-estudio');
    const input = document.getElementById('input-respuesta');
    const txtDefinicion = document.getElementById('pista-definicion');

    if (feedback) feedback.textContent = '';
    if (input) {
        input.value = '';
        input.style.borderColor = '#ddd';
        input.disabled = false;
        input.focus();
    }

    try {
        const { data, error } = await engine.supabase
            .from('palabras')
            .select('*')
            .order('nivel', { ascending: true })
            .limit(25);

        if (error) throw error;

        if (data && data.length > 0) {
            palabraActualEstudio = data[Math.floor(Math.random() * data.length)];
            
            // PISTA: Usamos el campo inicial o el término, pero QUITAMOS EL ACENTO para la pista
            const letraConAcento = palabraActualEstudio.inicial || palabraActualEstudio.termino.charAt(0);
            const letraSinAcento = letraConAcento.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            txtDefinicion.innerHTML = `
                <div style="margin-bottom: 15px; font-size: 1.1em; line-height: 1.4;">${palabraActualEstudio.definicion}</div>
                <div style="background: #f0f4f8; padding: 10px; border-radius: 8px; color: #1f538d; font-weight: bold; display: inline-block; border-left: 4px solid #1f538d;">
                    Empieza por: <span style="text-transform: uppercase; font-size: 1.3em; color: #d35400;">${letraSinAcento}</span>
                </div>
            `;
        } else {
            txtDefinicion.textContent = "No hay palabras para estudiar.";
        }
    } catch (err) {
        console.error(err);
        txtDefinicion.textContent = "Error al conectar con Supabase.";
    }
}

async function comprobarRespuesta() {
    const input = document.getElementById('input-respuesta');
    const feedback = document.getElementById('feedback-estudio');
    const respuesta = input.value.trim();

    if (!palabraActualEstudio || input.disabled) return;
    input.disabled = true;

    // VALIDACIÓN ESTRICTA (Tú escribes con acentos, comparamos con la base de datos)
    if (respuesta === palabraActualEstudio.termino) {
        feedback.innerHTML = '<span style="color: #27ae60;">✅ ¡Correcto! Nivel subido.</span>';
        input.style.borderColor = '#27ae60';
        await engine.supabase
            .from('palabras')
            .update({ nivel: (palabraActualEstudio.nivel || 0) + 1 })
            .eq('id', palabraActualEstudio.id);
        setTimeout(cargarNuevaPalabraEstudio, 1200);
    } else {
        feedback.innerHTML = `<span style="color: #e74c3c;">❌ Error. Era: <strong>${palabraActualEstudio.termino}</strong></span>`;
        input.style.borderColor = '#e74c3c';
        await engine.supabase
            .from('palabras')
            .update({ nivel: 0 })
            .eq('id', palabraActualEstudio.id);
        setTimeout(cargarNuevaPalabraEstudio, 3500);
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
    document.getElementById('game-hint').textContent = 'Definición: ' + gameState.pista;
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
    if (gameState.palabra.includes(l)) gameState.adivinadas.push(l);
    else { gameState.fallos++; dibujarAhorcado(gameState.fallos); }
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