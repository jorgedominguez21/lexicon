// script.js - Lexicon Studio Web con Supabase REAL corregido

class PalabrasEngine {
    constructor() {
        this.supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        this.words = [];
        this.loading = false;
        this.loadWords();
    }

    async loadWords() {
        this.loading = true;
        updateStats(); // Muestra "Cargando..." al inicio
        try {
            const { data, error } = await this.supabase
                .from('palabras')
                .select('*')
                .order('termino');
            if (error) throw error;
            this.words = data || [];
        } catch (error) {
            console.error('Error Supabase:', error);
            this.words = [];
        }
        this.loading = false;
        updateStats();
        updateLista();
    }

    async listarRapido(filtro = '') {
        if (this.loading) return [];
        const normalized = filtro.toLowerCase();
        return this.words.filter(w => 
            w.termino.toLowerCase().includes(normalized)
        ).slice(0, 100);
    }

    async obtenerPalabraAzar() {
        if (!this.words.length) return { termino: 'PRUEBA', definicion: 'Conecta Supabase para palabras reales' };
        const rand = this.words[Math.floor(Math.random() * this.words.length)];
        return { termino: rand.termino.toUpperCase(), definicion: rand.definicion };
    }

    // Corregido para que devuelva el número correctamente
    async contarTotal() {
        return this.words.length;
    }

    async insertar(termino, definicion, tipo) {
        const { data, error } = await this.supabase
            .from('palabras')
            .insert([{ termino: termino.toLowerCase(), definicion, tipo }])
            .select()
            .single();
        if (error) {
            console.error(error);
            return 'Error: ' + error.message;
        }
        this.words.unshift(data);
        updateStats();
        return 'OK';
    }

    async actualizar(id, termino, definicion, tipo) {
        const { data, error } = await this.supabase
            .from('palabras')
            .update({ termino: termino.toLowerCase(), definicion, tipo })
            .eq('id', id)
            .select()
            .single();
        if (error) return 'Error: ' + error.message;
        const idx = this.words.findIndex(w => w.id === id);
        if (idx > -1) this.words[idx] = data;
        return 'OK';
    }

    async eliminar(id) {
        const { error } = await this.supabase
            .from('palabras')
            .delete()
            .eq('id', id);
        if (error) return 'Error: ' + error.message;
        this.words = this.words.filter(w => w.id !== id);
        updateStats();
        return 'OK';
    }

    getCategorias() {
        return {
            'sust': 'Sustantivo', 'adj': 'Adjetivo', 'verb': 'Verbo', 'adv': 'Adverbio',
            'pron': 'Pronombre', 'prep': 'Preposición', 'conj': 'Conjunción', 'inter': 'Interjección'
        };
    }
}

const engine = new PalabrasEngine();
let selectedId = null;

// UI
document.addEventListener('DOMContentLoaded', initUI);

async function initUI() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.id !== 'btn-stats') {
                switchSection(e.target.id.replace('btn-', ''));
            }
        });
    });

    document.getElementById('busqueda').addEventListener('input', debounceSearch);
    document.getElementById('btn-save').addEventListener('click', saveWord);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
    // document.getElementById('btn-delete').addEventListener('click', deleteWord); // disabled

    switchSection('dashboard');
}

const debounceTimer = { id: null };
function debounceSearch() {
    clearTimeout(debounceTimer.id);
    debounceTimer.id = setTimeout(updateLista, 300);
}

async function updateLista() {
    const filtro = document.getElementById('busqueda').value;
    const lista = document.getElementById('lista-palabras');
    if (!lista) return;

    lista.innerHTML = engine.loading ? '<div class="loading">🔄 Cargando palabras de Supabase...</div>' : '';

    const palabras = await engine.listarRapido(filtro);

    lista.innerHTML = '';
    palabras.forEach(p => {
        const card = document.createElement('div');
        card.className = 'palabra-card';
        card.onclick = () => viewWord(p);  // Changed to view only
        card.innerHTML = `
            <div class="palabra-titulo">${p.termino.toUpperCase()}</div>
            <span class="palabra-cat">${engine.getCategorias()[p.tipo] || p.tipo}</span>
            <div class="palabra-prev">${p.definicion.substring(0, 100)}${p.definicion.length > 100 ? '...' : ''}</div>
            <div style="margin-top:10px">
                <a href="https://dle.rae.es/${p.termino}" target="_blank" class="rae-link">RAE</a> |
                <a href="https://es.wiktionary.org/wiki/${p.termino}" target="_blank" class="wiki-link">Wiki</a>
            </div>
        `;
        lista.appendChild(card);
    });
}

// ESTA FUNCIÓN ESTABA DANDO EL ERROR [object Promise]
async function updateStats() {
    const statsEl = document.getElementById('stats-total');
    if (!statsEl) return;
    
    if (engine.loading) {
        statsEl.textContent = 'Cargando palabras de Supabase...';
    } else {
        // Añadido await para obtener el número real
        const total = await engine.contarTotal();
        statsEl.textContent = `Total palabras Supabase: ${total}`;
    }
}

function viewWord(p) {
    selectedId = p.id;
    document.getElementById('modal-title').textContent = 'Ver: ' + p.termino;
    document.getElementById('input-word').value = p.termino;
    document.getElementById('input-cat').value = p.tipo || 'sust';
    document.getElementById('input-def').value = p.definicion;
    document.getElementById('modal-edit').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-edit').classList.remove('active');
    selectedId = null;
    document.getElementById('input-word').value = '';
    document.getElementById('input-cat').value = 'sust';
    document.getElementById('input-def').value = '';
    document.getElementById('btn-delete').style.display = 'none';
    document.getElementById('modal-title').textContent = 'Nueva Palabra';
}

// saveWord disabled for web readonly
async function saveWord() {
    alert('Modificaciones deshabilitadas en web. Usa app nativa.');
}

// deleteWord disabled for web readonly
async function deleteWord() {
    alert('Borrar deshabilitado en web. Usa app nativa.');
}

// --- JUEGO AHORCADO ---
let game = null;

async function initJuego() {
    game = { 
        palabra: '', 
        pista: '', 
        intentos: 6, 
        adivinadas: new Set(), 
        falladas: new Set(), 
        gameOver: false, 
        canvas: document.getElementById('canvas-ahorcado'), 
        ctx: null 
    };
    if (game.canvas) {
        game.ctx = game.canvas.getContext('2d');
        resizeCanvas();
    }
    
    const wordData = await engine.obtenerPalabraAzar();
    game.palabra = wordData.termino;
    game.pista = wordData.definicion;
    document.getElementById('game-hint').textContent = 'Pista: ' + game.pista;
    
    createTeclado();
    updatePantallaJuego();
}

function switchSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const targetSection = document.getElementById(section);
    const targetBtn = document.getElementById('btn-' + section);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    if (section === 'juego') initJuego();
}

// Mobile menu toggle with overlay close
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    
    if (menuToggle && sidebar && mainContent) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
        
        // Close sidebar clicking outside
        mainContent.addEventListener('click', function() {
            sidebar.classList.remove('active');
        });
        
        // Prevent close when click inside sidebar
        sidebar.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
});

// Categorías del selector modal
const catSelect = document.getElementById('input-cat');
if (catSelect) {
    catSelect.innerHTML = '';
    Object.entries(engine.getCategorias()).forEach(([key, val]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = val;
        catSelect.appendChild(opt);
    });
}

// Funciones básicas del ahorcado para que no den error
function resizeCanvas() { if (game && game.ctx) { /* Lógica de dibujo */ } }
function createTeclado() { 
    const teclado = document.getElementById('teclado');
    if (!teclado) return;
    teclado.innerHTML = '';
    'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').forEach(letra => {
        const btn = document.createElement('button');
        btn.textContent = letra;
        btn.className = 'tecla';
        btn.onclick = () => probarLetra(letra);
        teclado.appendChild(btn);
    });
}
function probarLetra(letra) {
    if (!game || game.gameOver || game.adivinadas.has(letra) || game.falladas.has(letra)) return;
    if (game.palabra.includes(letra)) {
        game.adivinadas.add(letra);
    } else {
        game.falladas.add(letra);
        game.intentos--;
    }
    updatePantallaJuego();
}
function updatePantallaJuego() {
    const display = document.getElementById('palabra-mostrada');
    if (!display) return;
    display.textContent = game.palabra.split('').map(l => game.adivinadas.has(l) ? l : '_').join(' ');
    document.getElementById('intentos-restantes').textContent = `Intentos: ${game.intentos}`;
}