// personas.js
document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = 'https://fi.jcaguilar.dev/v1/escuela/persona';
  const rolMap = { 1: 'Alumno', 2: 'Profesor', 3: 'Administrativo', 4: 'Otro' };
  const qs = (sel, ctx = document) => ctx.querySelector(sel);

  // Toast y banner de estado
  function toast(msg, type = 'info') {
    const box = document.getElementById('toast');
    if (!box) return;
    box.textContent = msg;
    box.className = `toast ${type} show`;
    setTimeout(() => box.classList.remove('show'), 2000);
  }
  function setStatus(msg = null) {
    const s = document.getElementById('status');
    if (!s) return;
    if (msg) { s.textContent = msg; s.classList.add('show'); }
    else { s.classList.remove('show'); }
  }

  const formatDateOut = (iso) => {
    if (!iso) return '';
    try { const [y, m, d] = iso.split('-'); return (y && m && d) ? `${d}/${m}/${y}` : iso; } catch { return iso; }
  };
  const getRowId = (p) => p?.id ?? p?.persona_id ?? p?.id_persona ?? p?.personaId ?? null;

  async function loadTable() {
    const tbody = qs('#tabla tbody');
    setStatus('Cargando datos...');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(null);
      tbody.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Sin registros</td></tr>';
        return;
      }

      data.forEach(p => {
        const id = getRowId(p);
        const isoFecha = p.fh_nac || p.fecha || ''; // ISO desde API
        const tr = document.createElement('tr');
        tr.dataset.id = id ?? '';
        tr.dataset.fecha = isoFecha; // para el modal

        const sexoOut = p.sexo
          ? (String(p.sexo).toUpperCase() === 'M' ? 'Femenino'
            : String(p.sexo).toUpperCase() === 'F' ? 'Femenino'
            : String(p.sexo).toUpperCase() === 'H' ? 'Masculino'
            : 'Otro')
          : 'N/A';

        tr.innerHTML = `
          <td>${p.nombre ?? ''}</td>
          <td>${p.apellido ?? ''}</td>
          <td>${sexoOut}</td>
          <td>${formatDateOut(isoFecha) || 'N/A'}</td>
          <td>${rolMap[p.id_rol] || p.rol || 'Desconocido'}</td>
          <td>${p.calificacion ?? 'N/A'}</td>
          <td>
            <button class="btn btn-sm btn-edit" type="button">Editar</button>
            <button class="btn btn-sm btn-danger btn-del" type="button">Eliminar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      setStatus('Error al cargar. Intenta nuevamente.');
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar: ${e.message}</td></tr>`;
    }
  }

  // Carga inicial
  loadTable();

  // Crear desde el formulario lateral
  const userForm = document.getElementById('userForm');
  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nombre = qs('#name', userForm).value.trim();
      const apellido = qs('#lastname', userForm).value.trim();
      const sexo = qs('input[name="sexo"]:checked', userForm)?.value; // 'h'|'m'|'o'
      const fh_nac = qs('#fh_nac', userForm).value; // ISO (YYYY-MM-DD)
      const id_rol = Number(qs('#rol', userForm).value);
      const calRaw = qs('#calificacion', userForm)?.value ?? '';
      const calificacion = calRaw === '' ? null : Number(calRaw);

      if (!nombre || !apellido || !sexo || !fh_nac || !id_rol) {
        alert('Completa todos los campos.');
        return;
      }

      try {
        setStatus('Procesando...');
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, apellido, sexo, fh_nac, id_rol, calificacion })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast('Creado', 'success');
        await loadTable();
        userForm.reset();
      } catch (err) {
        toast('Error al crear', 'error');
        alert('Error al crear: ' + err.message);
      } finally {
        setStatus(null);
      }
    });
  }

  // Editar / Eliminar desde la tabla
  const table = document.getElementById('tabla');
  if (table) {
    table.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr'); if (!tr) return;
      const id = tr.dataset.id;

      // Eliminar
      if (e.target.closest('.btn-del')) {
        const ok = confirm(`¿Eliminar a ${tr.children[0]?.textContent || ''} ${tr.children[1]?.textContent || ''}?`);
        if (!ok) return;

        try {
          setStatus('Eliminando...');
          const res = await fetch(API_BASE, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_persona: id })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast('Eliminado', 'success');
          await loadTable();
        } catch (err) {
          toast('Error al eliminar', 'error');
          alert('Error al eliminar: ' + err.message);
        } finally {
          setStatus(null);
        }
      }

      // Editar
      if (e.target.closest('.btn-edit')) {
        // map texto->radio
        const sTxt = tr.children[2]?.textContent.trim();
        const sex = sTxt === 'Masculino' ? 'h' : sTxt === 'Femenino' ? 'm' : 'o';

        openModal('Editar persona', {
          id,
          nombre: tr.children[0]?.textContent || '',
          apellido: tr.children[1]?.textContent || '',
          sexo: sex,
          fh_nac: tr.dataset.fecha || '', // ISO actual
          id_rol: (() => {
            const tx = tr.children[4]?.textContent.trim();
            const f = Object.entries(rolMap).find(([, v]) => v === tx);
            return f ? Number(f[0]) : 1;
          })(),
          calificacion: tr.children[5]?.textContent === 'N/A' ? '' : Number(tr.children[5]?.textContent)
        });
      }
    });
  }

  // Modal
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modalOverlay');
  const modalForm = document.getElementById('modalForm');
  const modalTitle = document.getElementById('modalTitle');

  function openModal(title, payload = null) {
    modalTitle.textContent = title;
    modal.dataset.mode = payload ? 'edit' : 'create';
    modal.dataset.id = payload?.id || '';
    modalForm.reset();

    if (payload) {
      qs('#nombre', modalForm).value = payload.nombre ?? '';
      qs('#apellido', modalForm).value = payload.apellido ?? '';
      const sex = payload.sexo ?? 'o';
      qs(`input[name="sexo"][value="${sex}"]`, modalForm)?.click();
      qs('#fh_nac', modalForm).value = payload.fh_nac ?? ''; // ISO
      qs('#id_rol', modalForm).value = payload.id_rol ?? '1';
      qs('#calificacion', modalForm).value = payload.calificacion ?? '';
    }
    overlay.classList.add('show');
    modal.classList.add('show');
  }
  function closeModal() { overlay.classList.remove('show'); modal.classList.remove('show'); }
  document.getElementById('btnNuevo')?.addEventListener('click', () => openModal('Nueva persona'));
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalClose2')?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') closeModal(); });

  // Guardar (create/edit) desde modal
  modalForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = qs('#nombre', modalForm).value.trim();
    const apellido = qs('#apellido', modalForm).value.trim();
    const sexo = qs('input[name="sexo"]:checked', modalForm)?.value; // 'h'|'m'|'o'
    const fh_nac = qs('#fh_nac', modalForm).value; // ISO
    const id_rol = Number(qs('#id_rol', modalForm).value);
    const calRaw = qs('#calificacion', modalForm).value;
    const calificacion = calRaw === '' ? null : Number(calRaw);

    const errs = [];
    if (!nombre) errs.push('Nombre es requerido');
    if (!apellido) errs.push('Apellido es requerido');
    if (!sexo) errs.push('Sexo es requerido');
    if (!fh_nac) errs.push('Fecha de nacimiento es requerida');
    if (!id_rol) errs.push('Rol es requerido');

    const errBox = document.getElementById('modalErrors');
    if (errs.length) {
      errBox.innerHTML = errs.map(e => `<div class="err">${e}</div>`).join('');
      errBox.style.display = 'block';
      return;
    } else {
      errBox.style.display = 'none';
      errBox.innerHTML = '';
    }

    const mode = modal.dataset.mode;
    const id = modal.dataset.id || null;

    try {
      setStatus('Guardando...');
      if (mode === 'create') {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, apellido, sexo, fh_nac, id_rol, calificacion })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast('Creado', 'success');
      } else {
        // PATCH con fh_nac y id_persona (requisito del backend)
        const payload = { id_persona: id, nombre, apellido, sexo, fh_nac, id_rol };
        if (calificacion !== null && !Number.isNaN(calificacion)) payload.calificacion = calificacion;

        const res = await fetch(API_BASE, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const txt = await res.clone().text().catch(() => '');
        if (!res.ok) throw new Error(`HTTP ${res.status}${txt ? ` - ${txt}` : ''}`);
        toast('Actualizado', 'success');
      }
      closeModal();
      await loadTable(); // rehace filas con fh_nac actualizado
    } catch (err) {
      console.error('Error PATCH/POST:', err);
      toast('Error al guardar', 'error');
      alert('Error al guardar: ' + err.message);
    } finally {
      setStatus(null);
    }
  });
});