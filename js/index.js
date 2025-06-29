let registros = [];
let indexAEliminar = null;
let filtroDesde = null;
let filtroHasta = null;
let filtroMes = null;
let ordenarPor = 'fecha'; // o 'valor'
let ordenAscendente = true;

// SUPABASE
const supabaseUrl = 'https://yntcwdxbosigqbkmugmm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InludGN3ZHhib3NpZ3Fia211Z21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMDA4NTQsImV4cCI6MjA2NTU3Njg1NH0.tKrxpjf2z1mkRnhPJzjHChL_nfuToKwqX_h3SbRKx20';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log(window.supabase);

function cargarDesdeLocalStorage() {
    const datos = localStorage.getItem('registrosAhorro');
    if (datos) {
        registros = JSON.parse(datos);
    }
}

function renderTabla() {
    const contenedor = document.getElementById('table-container');
    contenedor.innerHTML = '';

    // Mostrar mensaje si no hay datos
    if (registros.length === 0) {
        contenedor.innerHTML = '<p id="no-data">No Data Yet</p>';
        return;
    }

    const tabla = document.createElement('table');
    const encabezado = `
        <tr>
            <th>Valor</th>
            <th>Fecha</th>
            <th></th>
        </tr>
    `;
    

    // Crear filas normales
    let registrosFiltrados = registros
        .map((reg, index) => ({ reg, index }))
        .filter(({ reg }) => !reg.editando);

    // Aplicar filtro si hay fechas
    if (filtroDesde || filtroHasta || filtroMes) {
        registrosFiltrados = registrosFiltrados.filter(({ reg }) => {
            const fechaReg = new Date(reg.fecha);

            const desde = filtroDesde ? new Date(filtroDesde) : null;
            const hasta = filtroHasta ? new Date(filtroHasta) : null;

            let pasaFecha = (!desde || fechaReg >= desde) && (!hasta || fechaReg <= hasta);

            if (filtroMes) {
                const [anio, mes] = filtroMes.split('-');
                const mesFiltro = parseInt(mes, 10);
                const anioFiltro = parseInt(anio, 10);

                const mesReg = fechaReg.getMonth() + 1;
                const anioReg = fechaReg.getFullYear();

                pasaFecha = pasaFecha && (mesFiltro === mesReg && anioFiltro === anioReg);
            }

            return pasaFecha;
        });
    }

    // Aplicar ordenamiento si hay registros
    if (ordenarPor) {
        registrosFiltrados.sort((a, b) => {
            const valorA = ordenarPor === 'fecha'
                ? new Date(a.reg.fecha)
                : Number(a.reg.valor);

            const valorB = ordenarPor === 'fecha'
                ? new Date(b.reg.fecha)
                : Number(b.reg.valor);

            return ordenAscendente ? valorA - valorB : valorB - valorA;
        });
    }


    let filas = registrosFiltrados.map(({ reg, index }) => `
        <tr class="fade-in">
            <td onclick="editarCelda(${index}, 'valor', this)">
                $${Number(reg.valor).toLocaleString('es-CO')}
            </td>
            <td onclick="editarCelda(${index}, 'fecha', this)">
                ${formatearFecha(reg.fecha)}
            </td>
            <td>
                <button onclick="eliminarFila(${index})" class="btn-eliminar">🗑️</button>
            </td>
        </tr>
    `).join('');

    const filaEditable = registros.find(r => r.editando);
    if (filaEditable) {
        filas += `
            <tr class="fade-in">
                <td><input type="text" id="input-valor" placeholder="$"></td>
                <td><input type="date" id="input-fecha"></td>
                <td></td>
            </tr>
        `;
    }

    tabla.innerHTML = encabezado + filas;
    contenedor.appendChild(tabla);

    // === Mostrar/Ocultar botones ===
    const hayEdicion = registros.some(r => r.editando) || document.querySelector('#table-container input');

    const btnAgregar = document.getElementById('btn-agregar');
    const btnGuardar = document.getElementById('btn-guardar');
    const btnCancelar = document.getElementById('btn-cancelar');

    btnAgregar.style.display = hayEdicion ? 'none' : 'flex';
    btnGuardar.style.display = hayEdicion ? 'inline-block' : 'none';
    btnCancelar.style.display = hayEdicion ? 'inline-block' : 'none';

    mostrarTotal(registrosFiltrados.map(({ reg }) => reg));

    mostrarFechasDuplicadas(); // Ahora abre el modal si hay duplicados
}

function agregarFila() {
    // Solo una fila editable a la vez
    if (registros.some(r => r.editando)) return;
    registros.push({ editando: true });
    renderTabla();
}

// Editar con supabase

function editarCelda(index, campo, celda) {
    const valorActual = registros[index][campo];
    const input = document.createElement('input');

    input.type = campo === 'valor' ? 'text' : 'date';
    input.value = campo === 'valor'
        ? Number(valorActual).toLocaleString('es-CO')
        : valorActual;

    input.style.width = '90%';

    input.addEventListener('input', () => {
        if (campo === 'valor') {
            const limpio = input.value.replace(/\D/g, '');
            input.value = Number(limpio).toLocaleString('es-CO');
        }
    });

    input.addEventListener('blur', async () => {
        let nuevoValor;
        if (campo === 'valor') {
            nuevoValor = input.value.replace(/\D/g, '');
        } else {
            nuevoValor = input.value;
        }

        // Actualiza localmente
        registros[index][campo] = nuevoValor;

        // Actualiza en Supabase
        try {
            const { error } = await supabase
                .from('registros')
                .update({ [campo]: nuevoValor })
                .eq('id', registros[index].id);

            if (error) {
                console.error('❌ Error al actualizar en Supabase:', error);
                mostrarModalAlerta('Error al actualizar en Supabase.');
            }
        } catch (e) {
            console.error('🚨 Excepción al actualizar en Supabase:', e);
            mostrarModalAlerta('Error inesperado al actualizar.');
        }

        guardarEnLocalStorage(); // Opcional, si aún lo usas
        renderTabla();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    celda.innerHTML = '';
    celda.appendChild(input);

    setTimeout(() => {
        input.focus();
        if (campo === 'fecha') input.showPicker?.();
    }, 0);
}

// function editarCelda(index, campo, celda) {
//     const valorActual = registros[index][campo];
//     const input = document.createElement('input');

//     input.type = campo === 'valor' ? 'text' : 'date';
//     input.value = campo === 'valor'
//         ? Number(valorActual).toLocaleString('es-CO')
//         : valorActual;

//     input.style.width = '90%';

//     input.addEventListener('input', () => {
//         if (campo === 'valor') {
//             const limpio = input.value.replace(/\D/g, '');
//             input.value = Number(limpio).toLocaleString('es-CO');
//         }
//     });

//     input.addEventListener('blur', async () => {
//         let nuevoValor;
//         if (campo === 'valor') {
//             nuevoValor = input.value.replace(/\D/g, '');
//         } else {
//             nuevoValor = input.value;
//         }

//         // Actualiza localmente
//         registros[index][campo] = nuevoValor;

//         // Actualiza en Supabase
//         try {
//             const { error } = await supabase
//                 .from('registros')
//                 .update({ [campo]: nuevoValor })
//                 .eq('id', registros[index].id);

//             if (error) {
//                 console.error('❌ Error al actualizar en Supabase:', error);
//                 mostrarModalAlerta('Error al actualizar en Supabase.');
//             }
//         } catch (e) {
//             console.error('🚨 Excepción al actualizar en Supabase:', e);
//             mostrarModalAlerta('Error inesperado al actualizar.');
//         }

//         guardarEnLocalStorage(); // Opcional, si aún lo usas
//         renderTabla();
//     });

//     input.addEventListener('keydown', (e) => {
//         if (e.key === 'Enter') {
//             input.blur();
//         }
//     });

//     celda.innerHTML = '';
//     celda.appendChild(input);

//     setTimeout(() => {
//         input.focus();
//         if (campo === 'fecha') input.showPicker?.();
//     }, 0);
// }

function guardarEnLocalStorage() {
    const registrosFiltrados = registros.filter(r => !r.editando);
    localStorage.setItem('registrosAhorro', JSON.stringify(registrosFiltrados));
}

function formatearFecha(fechaISO) {
    const [anio, mes, dia] = fechaISO.split('-');
    return `${dia}/${mes}/${anio}`;
}

function cancelarFila() {
    registros = registros.filter(r => !r.editando);
    renderTabla();
}

function cerrarModal() {
    const modal = document.getElementById('modal-confirm');
    modal.classList.remove('show');
    indexAEliminar = null;
}

// Boton confirmar eliminar
document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if (indexAEliminar !== null) {
        const id = registros[indexAEliminar].id;

        const { error } = await supabase
            .from('registros')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ Error al eliminar en Supabase:', error);
            mostrarModalAlerta("Error al eliminar en Supabase.");
            return;
        }

        registros.splice(indexAEliminar, 1);
        renderTabla();
        cerrarModal();
    }
});

function mostrarTotal(registrosAMostrar) {
    const totalContainer = document.getElementById('total-container');

    const total = registrosAMostrar
        .reduce((acc, r) => acc + Number(r.valor || 0), 0);

    totalContainer.innerHTML = `Total: <span class="numero-total">$${total.toLocaleString('es-CO')}</span>`;
    totalContainer.classList.add('visible');
}

function aplicarFiltro() {
    filtroDesde = document.getElementById('filtro-desde').value;
    filtroHasta = document.getElementById('filtro-hasta').value;
    filtroMes = document.getElementById('filtro-mes').value;
    renderTabla();
}

function limpiarFiltro() {
    filtroDesde = null;
    filtroHasta = null;
    filtroMes = null;

    document.getElementById('filtro-desde').value = '';
    document.getElementById('filtro-hasta').value = '';
    document.getElementById('filtro-mes').value = '';

    renderTabla();
}

function mostrarModalAlerta(mensaje) {
    const modal = document.getElementById('modal-alerta');
    document.getElementById('mensaje-modal').textContent = mensaje;
    modal.classList.add('show');
}

function cerrarModalAlerta() {
    const modal = document.getElementById('modal-alerta');
    modal.classList.remove('show');
}

function cambiarOrden() {
    ordenarPor = document.getElementById('ordenar-por').value;
    ordenAscendente = document.getElementById('tipo-orden').value === 'asc';
    renderTabla();
}

function detectarFechasDuplicadas() {
    const conteoFechas = {};
    const duplicados = [];

    registros.forEach(r => {
        const fecha = r.fecha;
        if (conteoFechas[fecha]) {
            conteoFechas[fecha]++;
        } else {
            conteoFechas[fecha] = 1;
        }
    });

    for (const fecha in conteoFechas) {
        if (conteoFechas[fecha] > 1) {
            duplicados.push(fecha);
        }
    }

    return duplicados;
}

function mostrarFechasDuplicadas() {
    const duplicadas = detectarFechasDuplicadas();
    console.log("🔍 Fechas duplicadas:", duplicadas);
    if (duplicadas.length === 0) return;

    const lista = document.getElementById('lista-fechas-duplicadas');
    lista.innerHTML = duplicadas
        .map(f => `<li>${formatearFecha(f)}</li>`)
        .join('');

    document.getElementById('modal-duplicados').classList.add('show');
}

function cerrarModalDuplicados() {
    document.getElementById('modal-duplicados').classList.remove('show');
}

// CODIGO SUPABASE
async function guardarEnSupabase(valor, fecha) {
  try {
    const { data, error } = await supabase
      .from('registros')
      .insert([{ valor, fecha }])
      .select(); // Asegura que te devuelva el objeto insertado

    if (error || !data || data.length === 0) {
      console.error('Error al guardar:', error || 'No se recibió data');
      mostrarModalAlerta("Error al guardar en Supabase.");
      return;
    }

    registros.push(data[0]);
    renderTabla();

  } catch (e) {
    console.error('Excepción al guardar:', e);
    mostrarModalAlerta("Error inesperado al guardar en Supabase.");
  }
}

async function guardarFila() {
    const inputValor = document.getElementById('input-valor');
    const inputFecha = document.getElementById('input-fecha');

    if (!inputValor || !inputFecha) return;

    const valor = inputValor.value.trim();
    const fecha = inputFecha.value;

    if (valor === '' || fecha === '') {
        mostrarModalAlerta("Por favor completa ambos campos.");
        return;
    }

    // Validar fecha duplicada
    const duplicada = registros.some(r => r.fecha === fecha);
    if (duplicada) {
        mostrarFechasDuplicadas();
        return;
    }

    // Eliminar fila de edición
    registros = registros.filter(r => !r.editando);

    // Guardar en Supabase
    await guardarEnSupabase(valor, fecha);
}

function eliminarFila(index) {
    indexAEliminar = index;
    const modal = document.getElementById('modal-confirm');
    modal.classList.add('show');
}

async function cargarDesdeSupabase() {
  try {
    const { data, error } = await 
        supabase
        .from('registros')
        .select('*')
        .order('fecha', { ascending: true });

        console.log("DATA:", data);
        console.log("ERROR:", error);

        if (error) {
        console.error("❌ Error al cargar desde Supabase:", error);
        mostrarModalAlerta("Error al cargar datos desde Supabase.");
        return;
        }

        if (!data || data.length === 0) {
        console.warn("⚠️ No se encontraron registros en Supabase.");
        registros = []; // Vacía si no hay nada
        } else {
        registros = data;
        }

        renderTabla();

  } catch (e) {
        console.error("🚨 Excepción al cargar desde Supabase:", e);
        mostrarModalAlerta("Error inesperado al cargar los datos.");
  }
}

// Inicial
// cargarDesdeLocalStorage();
cargarDesdeSupabase();

// Asegura que supabase esté disponible
document.addEventListener('DOMContentLoaded', () => {
    if (typeof cargarDesdeSupabase === 'function') {
        cargarDesdeSupabase();
    } else {
        console.error("❌ cargarDesdeSupabase no está definida.");
    }
});