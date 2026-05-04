import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from "jspdf";

const listaCarros = [
  { modelo: "Corolla", placa: "ABC1234", valor: 250 },
  { modelo: "Onix", placa: "XYZ5678", valor: 120 },
  { modelo: "Civic", placa: "DEF9012", valor: 220 },
  { modelo: "Kwid", placa: "GHI3456", valor: 100 },
  { modelo: "T-Cross", placa: "JKL7890", valor: 180 }
];

// Função para converter coordenadas em endereço usando Nominatim (OpenStreetMap)
const buscarEnderecoPorGPS = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'User-Agent': 'LocadoraApp/1.0'
        }
      }
    );
    const data = await response.json();

    if (data && data.display_name) {
      return data.display_name;
    } else {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)} (Coordenadas GPS)`;
    }
  } catch (error) {
    console.error("Erro ao buscar endereço:", error);
    return `${lat.toFixed(6)}, ${lon.toFixed(6)} (Coordenadas GPS)`;
  }
};

function App() {
  const [carroSelecionado, setCarroSelecionado] = useState("");
  const [statusAluguel, setStatusAluguel] = useState(false);
  const [dias, setDias] = useState("");
  const [taxas, setTaxas] = useState({ sujo: false, riscado: false, danificado: false });
  const [etapa, setEtapa] = useState('inicial');
  const [enderecoTexto, setEnderecoTexto] = useState("");
  const [fotoUrl, setFotoUrl] = useState(null);
  const [fotoBase64, setFotoBase64] = useState(null);
  const [mapaUrl, setMapaUrl] = useState("");
  const [resultadoTexto, setResultadoTexto] = useState("Aguardando operação");
  const [extrato, setExtrato] = useState(null);
  const [coordenadasGPS, setCoordenadasGPS] = useState({ lat: null, lon: null });
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);

  // Função para gerar o PDF com a imagem e endereço
  const gerarPDF = (dados, imagemBase64, endereco) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("COMPROVANTE DE DEVOLUÇÃO", 20, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Veículo: ${dados.veiculo}`, 20, 35);
    doc.text(`Dias: ${dados.dias}`, 20, 45);
    doc.line(20, 50, 190, 50);

    doc.text(`Subtotal Diárias: R$ ${dados.subtotal.toFixed(2)}`, 20, 60);
    doc.text(`Taxas Aplicadas: ${dados.taxasTexto}`, 20, 70);
    doc.text(`Total Multas: R$ ${dados.multas.toFixed(2)}`, 20, 80);
    doc.line(20, 85, 190, 85);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Total a Pagar: R$ ${dados.total.toFixed(2)}`, 20, 100);

    doc.setFontSize(10);
    doc.text("Foto da vistoria:", 20, 115);

    if (imagemBase64) {
      try {
        doc.addImage(imagemBase64, 'JPEG', 20, 120, 60, 45);
      } catch (error) {
        console.error("Erro ao adicionar imagem:", error);
        doc.text("(Imagem não disponível)", 20, 130);
      }
    } else {
      doc.text("(Nenhuma foto registrada)", 20, 130);
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Endereço da devolução:", 20, 180);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const splitEndereco = doc.splitTextToSize(`${endereco}`, 170);
    doc.text(splitEndereco, 20, 188);

    // Adiciona coordenadas GPS
    if (coordenadasGPS.lat && coordenadasGPS.lon) {
      doc.text(`Coordenadas GPS: ${coordenadasGPS.lat.toFixed(6)}, ${coordenadasGPS.lon.toFixed(6)}`, 20, 210);
    }

    doc.setFontSize(8);
    doc.text(`Data: ${new Date().toLocaleString()}`, 20, 270);

    doc.save(`Comprovante_${dados.veiculo}.pdf`);
  };

  const registrarAluguel = () => {
    if (!carroSelecionado) return alert("Selecione um carro!");
    setStatusAluguel(true);
    setResultadoTexto(`Veículo ${listaCarros[carroSelecionado].modelo} alugado com sucesso!`);
  };

  const registrarDevolucao = () => {
    if (!statusAluguel) return alert("Nenhum carro alugado!");
    if (!dias || dias <= 0) return alert("Informe os dias!");
    setEtapa('seguranca');
    setResultadoTexto("Realize a vistoria de devolução");
  };

  const finalizarVistoria = async (lat, lon, imagemBase64) => {
    setBuscandoEndereco(true);
    setResultadoTexto("Buscando endereço pelo GPS...");

    // Busca o endereço real pelas coordenadas GPS
    const enderecoReal = await buscarEnderecoPorGPS(lat, lon);
    setEnderecoTexto(enderecoReal);
    setCoordenadasGPS({ lat, lon });

    // Cria o mapa com as coordenadas reais
    const bbox = `${lon - 0.005},${lat - 0.005},${lon + 0.005},${lat + 0.005}`;
    setMapaUrl(`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`);

    setBuscandoEndereco(false);

    const carro = listaCarros[carroSelecionado];
    const subtotal = parseInt(dias) * carro.valor;

    let taxasLista = [];
    let valorTaxas = 0;
    if (taxas.sujo) { taxasLista.push("Limpeza (R$ 50,00)"); valorTaxas += 50; }
    if (taxas.riscado) { taxasLista.push("Reparo de Riscos (R$ 150,00)"); valorTaxas += 150; }
    if (taxas.danificado) { taxasLista.push("Avaria Grave (R$ 300,00)"); valorTaxas += 300; }

    const novoExtrato = {
      veiculo: `${carro.modelo} (${carro.placa})`,
      dias: dias,
      subtotal: subtotal,
      taxasTexto: taxasLista.join(", ") || "Nenhuma",
      multas: valorTaxas,
      total: subtotal + valorTaxas
    };

    setExtrato(novoExtrato);
    setResultadoTexto("DEVOLUÇÃO CONCLUÍDA - PDF gerado!");

    // CORREÇÃO: Passa o endereçoReal para o PDF
    gerarPDF(novoExtrato, imagemBase64, enderecoReal);
    setEtapa('inicial');
  };

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione um arquivo de imagem válido!");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imagemBase64 = event.target.result;
      setFotoUrl(URL.createObjectURL(file));
      setFotoBase64(imagemBase64);

      setResultadoTexto("Obtendo localização GPS...");

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            await finalizarVistoria(latitude, longitude, imagemBase64);
          },
          async (error) => {
            console.error("Erro de geolocalização:", error);
            alert(`Erro ao obter GPS: ${error.message}. Usando coordenadas padrão.`);
            await finalizarVistoria(-23.5505, -46.6333, imagemBase64);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      } else {
        alert("Geolocalização não suportada. Usando localização padrão.");
        await finalizarVistoria(-23.5505, -46.6333, imagemBase64);
      }
    };
    reader.onerror = () => {
      alert("Erro ao ler a imagem. Tente novamente.");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = () => {
    setEtapa('biometria');
  };

  useEffect(() => {
    return () => {
      if (fotoUrl) {
        URL.revokeObjectURL(fotoUrl);
      }
    };
  }, [fotoUrl]);

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 font-sans text-gray-800">
      <div className="max-w-xl mx-auto space-y-4">

        {/* CARD PRINCIPAL */}
        <div className="bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-[#0d6efd] p-3 text-white text-center font-bold text-xl flex justify-center items-center gap-2">
            Locadora 🚘
          </div>

          <div className="p-5 space-y-4">
            {/* TÍTULO SELECIONE O CARRO */}
            <div>
              <label className="font-bold text-sm block mb-1">Selecione o Carro:</label>
              <select
                className="w-full p-2 border rounded bg-white text-sm"
                value={carroSelecionado}
                onChange={(e) => setCarroSelecionado(e.target.value)}
                disabled={etapa !== 'inicial'}
              >
                <option value="">Escolha um veículo da lista...</option>
                {listaCarros.map((c, i) => (
                  <option key={i} value={i}>
                    {c.modelo} | {c.placa}
                  </option>
                ))}
              </select>
            </div>

            {/* DIAS DE ALUGUEL */}
            <div className="space-y-1">
              <label className="font-bold text-sm block">Dias de Aluguel (para devolução):</label>
              <input
                type="number"
                className="w-full p-2 border rounded text-sm"
                placeholder="Quantidade de dias"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                disabled={etapa !== 'inicial'}
                min="1"
              />
            </div>

            {/* VISTORIA DE DEVOLUÇÃO */}
            <div className="space-y-2">
              <p className="text-red-600 font-bold text-xs uppercase">VISTORIA DE DEVOLUÇÃO</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={taxas.sujo}
                  onChange={() => setTaxas({ ...taxas, sujo: !taxas.sujo })}
                  disabled={etapa !== 'inicial'}
                />
                Veículo está sujo (Taxa R$ 50,00)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={taxas.riscado}
                  onChange={() => setTaxas({ ...taxas, riscado: !taxas.riscado })}
                  disabled={etapa !== 'inicial'}
                />
                Possui riscos leves (Taxa R$ 150,00)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={taxas.danificado}
                  onChange={() => setTaxas({ ...taxas, danificado: !taxas.danificado })}
                  disabled={etapa !== 'inicial'}
                />
                Danos graves ou amassados (Taxa R$ 300,00)
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={registrarAluguel}
                className="bg-[#198754] text-white py-2 rounded font-bold text-sm hover:bg-[#157347] transition"
                disabled={etapa !== 'inicial' || !carroSelecionado}
              >
                Registrar Aluguel
              </button>
              <button
                onClick={registrarDevolucao}
                className="border border-red-500 text-red-500 py-2 rounded font-bold text-sm hover:bg-red-50 transition"
                disabled={etapa !== 'inicial' || !statusAluguel}
              >
                Registrar Devolução
              </button>
            </div>
          </div>

          {/* EXTRATO */}
          {extrato && (
            <div className="p-5 border-t bg-white space-y-1 text-sm border-b">
              <h3 className="font-bold uppercase text-xs mb-3 text-green-600">✅ DEVOLUÇÃO CONCLUÍDA</h3>
              <p><strong>Veículo:</strong> {extrato.veiculo}</p>
              <p><strong>Dias utilizados:</strong> {extrato.dias}</p>
              <p><strong>Subtotal Diárias:</strong> R$ {extrato.subtotal.toFixed(2)}</p>
              <p><strong>Taxas Aplicadas:</strong> {extrato.taxasTexto}</p>
              <p><strong>Total Multas:</strong> R$ {extrato.multas.toFixed(2)}</p>
              <div className="border-t mt-3 pt-3">
                <p className="text-base font-bold text-blue-600">💰 Total a Pagar: R$ {extrato.total.toFixed(2)}</p>
              </div>
              <div className="mt-2 p-2 bg-gray-50 rounded text-[10px]">
                <p><strong>📍 Endereço da devolução:</strong></p>
                <p className="break-words">{enderecoTexto || "Aguardando..."}</p>
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-2 text-center italic text-xs text-gray-500 border-t">
            {resultadoTexto}
          </div>
        </div>

        {/* PORTÃO DE SEGURANÇA */}
        {etapa !== 'inicial' && (
          <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-300 text-center space-y-6">
            <h4 className="font-bold text-sm flex justify-center items-center gap-2">🔐 Portão de segurança</h4>
            <div className="flex justify-center gap-4">
              <div className="border p-4 rounded bg-gray-50">
                <span className="text-4xl">🔑</span>
                <p className="text-[8px] mt-1">Chave Virtual</p>
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`w-32 h-20 border-2 border-dashed flex flex-col items-center justify-center rounded text-xs transition ${etapa === 'biometria' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }`}
              >
                {etapa === 'biometria' ? (
                  <>
                    <span className="text-2xl">✅</span>
                    <span>Chave aceita!</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">📌</span>
                    <span>Arraste aqui</span>
                    <span className="text-[8px]">a chave</span>
                  </>
                )}
              </div>
            </div>

            {etapa === 'biometria' && (
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-bold text-xs uppercase">Verificação de identidade e localização</h4>
                <div className="bg-blue-50 p-3 rounded">
                  <input
                    type="file"
                    onChange={handleFoto}
                    accept="image/*"
                    className="text-[10px] w-full p-2 border rounded bg-white"
                  />
                  <p className="text-[8px] text-gray-500 mt-1">📸 Tire uma foto do veículo para a vistoria</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold mb-1">📷 Foto da Vistoria:</p>
                    <div className="h-32 border rounded overflow-hidden bg-gray-100 relative">
                      {fotoUrl ? (
                        <>
                          <img src={fotoUrl} className="w-full h-full object-cover" alt="Vistoria" />
                          <div className="absolute top-1 left-1 bg-black bg-opacity-60 text-white p-1 rounded">
                            <p className="text-[6px] font-bold">VISTORIADO</p>
                            <p className="text-[6px]">{new Date().toLocaleString()}</p>
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex items-center justify-center text-[8px] text-gray-400">
                          ⏳ Aguardando foto...
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold mb-1">📍 Localização atual (GPS):</p>
                    <div className="h-32 border rounded overflow-hidden bg-gray-50">
                      {mapaUrl ? (
                        <iframe
                          width="100%"
                          height="100%"
                          src={mapaUrl}
                          title="Mapa de localização GPS"
                          style={{ border: 0 }}
                        ></iframe>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[8px] text-gray-400">
                          <span className="text-2xl">🌍</span>
                          <span>Aguardando GPS...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-100 p-2 rounded font-bold text-[9px] uppercase tracking-tighter border border-yellow-300">
                  {buscandoEndereco ? (
                    <span>🔍 Buscando endereço pelo GPS...</span>
                  ) : (
                    <>
                      📍 {enderecoTexto || "Aguardando localização GPS..."}
                      {coordenadasGPS.lat && coordenadasGPS.lon && (
                        <div className="text-[8px] text-gray-600 mt-1">
                          🛰️ Coordenadas: {coordenadasGPS.lat.toFixed(6)}, {coordenadasGPS.lon.toFixed(6)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;