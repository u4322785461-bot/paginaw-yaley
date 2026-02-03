// ===================== app.js =====================

// Cargar CSV al abrir la página
fetch("ventas_raw.csv")
  .then(res => res.text())
  .then(text => procesarCSV(text));

// Función principal
function procesarCSV(texto) {
  const filas = texto.trim().split("\n");
  const headers = filas[0].split(",");
  const raw = filas.slice(1).map(f => f.split(","));

  document.getElementById("info").innerText =
    `Filas antes de limpieza: ${raw.length}`;

  mostrarTabla("tableRaw", headers, raw.slice(0, 10));

  let clean = raw.map(f => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = f[i]?.trim());

    // Fecha válida
    const fecha = new Date(obj.fecha);
    if (isNaN(fecha)) return null;
    obj.fecha = fecha.toISOString().split("T")[0];

    // Normalizar franja
    obj.franja = obj.franja?.toLowerCase().includes("desa") ? "Desayuno" : "Comida";

    // Normalizar familia
    const fam = obj.familia?.toLowerCase();
    if (fam?.includes("beb")) obj.familia = "Bebida";
    else if (fam?.includes("entra")) obj.familia = "Entrante";
    else if (fam?.includes("post")) obj.familia = "Postre";
    else obj.familia = "Principal";

    // Producto
    if (!obj.producto) return null;
    obj.producto = obj.producto.toLowerCase().trim();

    // Números
    obj.unidades = Number(obj.unidades);
    obj.precio_unitario = Number(obj.precio_unitario);
    if (obj.unidades <= 0 || obj.precio_unitario <= 0) return null;

    // Recalcular importe
    obj.importe = obj.unidades * obj.precio_unitario;

    return obj;
  }).filter(f => f !== null);

  // Eliminar duplicados
  const seen = new Set();
  clean = clean.filter(o => {
    const key = JSON.stringify(o);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  document.getElementById("info").innerText +=
    ` | Filas después de limpieza: ${clean.length}`;

  mostrarTabla(
    "tableClean",
    headers,
    clean.slice(0, 10).map(o => headers.map(h => o[h]))
  );

  calcularKPIs(clean);
  crearGraficos(clean);
  prepararDescarga(clean, headers);
}

// Mostrar tabla
function mostrarTabla(id, headers, filas) {
  const table = document.getElementById(id);
  table.innerHTML = "";
  const thead = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.innerText = h;
    thead.appendChild(th);
  });
  table.appendChild(thead);

  filas.forEach(f => {
    const tr = document.createElement("tr");
    f.forEach(c => {
      const td = document.createElement("td");
      td.innerText = c;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
}

// KPIs
function calcularKPIs(data) {
  const totalVentas = data.reduce((s, d) => s + d.importe, 0);
  const totalUnidades = data.reduce((s, d) => s + d.unidades, 0);

  const porProducto = {};
  data.forEach(d => porProducto[d.producto] = (porProducto[d.producto] || 0) + d.importe);

  const top5 = Object.entries(porProducto)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5);

  document.getElementById("kpis").innerHTML = `
    <div class="kpi">💰 Ventas totales: €${totalVentas.toFixed(2)}</div>
    <div class="kpi">📦 Unidades totales: ${totalUnidades}</div>
    <div class="kpi">🏆 Top producto: ${top5[0]?.[0]}</div>
  `;
}

// Gráficos
function crearGraficos(data) {
  crearGrafico(
    "chartTop",
    "Top 5 productos",
    agrupar(data, "producto", "importe", 5)
  );
  crearGrafico(
    "chartFranja",
    "Ventas por franja",
    agrupar(data, "franja", "importe")
  );
  crearGrafico(
    "chartFamilia",
    "Ventas por familia",
    agrupar(data, "familia", "importe")
  );
}

function agrupar(data, campo, valor, top=null) {
  const obj = {};
  data.forEach(d => obj[d[campo]] = (obj[d[campo]] || 0) + d[valor]);
  let arr = Object.entries(obj);
  if (top) arr = arr.sort((a,b)=>b[1]-a[1]).slice(0,top);
  return arr;
}

function crearGrafico(id, titulo, datos) {
  new Chart(document.getElementById(id), {
    type: "bar",
    data: {
      labels: datos.map(d=>d[0]),
      datasets: [{
        label: titulo,
        data: datos.map(d=>d[1]),
        backgroundColor: "rgba(54,162,235,0.6)"
      }]
    }
  });
}

// Descargar CSV limpio
function prepararDescarga(data, headers) {
  document.getElementById("download").onclick = () => {
    const csv = [
      headers.join(","),
      ...data.map(d => headers.map(h => d[h]).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ventas_clean.csv";
    a.click();
  };
}
