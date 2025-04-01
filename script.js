/* 
    COMPARATIVO MARR-HILDRETH E CANNY:

    -  Ambos buscam detectar as transições de intensidade na imagem.

    1. MARR-HILDRETH:
    
    - Usa filtros do tipo Laplaciano de Gaussiano (LoG) (Suavizar e identificar variacoes de intensidade).
    - Usa o zero-crossing para identificar onde a resposta do Laplaciano muda de sinal (bordas).
    - Mais simples e rápido.
    - Menos robusto ao rúido podendo produzir bordas mais largas (imprecisao no zero-crossing por conta das intensidades variaveis).
    - Dificuldade em detectar bordas finas e detalhadas pois o filtro Laplaciano nao trata isso.
    - Produz bordas mais espessas e imprecisas, ainda mais em imagens com muitos ruidos.


    2. CANNY:

    - Tambem usa suavizacao.
    - Usa deteccao de gradiente (intensidade da imagem, detectar bordas).
    - Usa supressao de nao-maximos (busca o pico máximo da borda no gradiente).
    - Usa histerese (conectar bordas fracas e fortes com base em limiares, elimina bordas falsas).
    - Mais complexo e lento, caro computacionalmente.
    - Deteccao de bordas mais precisa.
    - Alta precisao em bordas finas.
    - Produzo bordas finas e contínuas.
    - Ideal para segmentacao de imagens para o recohecimento de objetos e extracao de caracteristicas.
*/


// --------------------------------------------------------------------------------------------------------
// VARIAVEIS, CONSTANTES E COMPONENTES
// --------------------------------------------------------------------------------------------------------
const canvas = document.querySelector("#window");
const canvasContext = canvas.getContext('2d');

const imageInput = document.querySelector("#uploadImg");
const algoritmo_selecionado = document.getElementById("algoritmos-PID");

const images_window = document.querySelector(".section-final-image");
const image = document.querySelector("#imageTag");
const grayImage = document.querySelector("#grayImageTag");
const binaryImage = document.querySelector("#binaryImageTag");
const operatedImg = document.querySelector("#operatedImageTag");

let imageData = null; // Manipular os atributos das imagens pelo canvas.


// --------------------------------------------------------------------------------------------------------
// EVENTOS INTERFACE
// --------------------------------------------------------------------------------------------------------
document.getElementById("algoritmos-PID").addEventListener("change", () => {
    let option = document.getElementById("algoritmos-PID").value;

    if (option == "Objetcs-Counter") {
        document.getElementById("div-objects-counter-options").style.display = "block";
    } else if (option == "Filtro-Box") {
        document.getElementById("div-box-filter-options").style.display = "block";
    }
    else {
        document.getElementById("div-objects-counter-options").style.display = "none";
        document.getElementById("div-box-filter-options").style.display = "none";
    }
});

document.getElementById("button-aplicar-algoritmo-PID").addEventListener("click", () => {
    algoritmo = algoritmo_selecionado.value;

    grayImage.style.display = "none";
    binaryImage.style.display = "none";
    operatedImg.style.display = "none";

    // Dispara o algoritmo selecionado na interface.
    if (algoritmo === "Marr-Hildreth") {
        applyMarrHildreth();
    } else if (algoritmo === "Canny") {
        applyCanny();
    } else if (algoritmo === "Otsu") {
        applyOtsu();
    } else if (algoritmo === "Watershed") {
        applyWatershed()
    } else if (algoritmo === "Objetcs-Counter") {
        let isBinaryImage = document.querySelector('input[name="is-image-binary"]:checked');
        let fill_holes = document.querySelector('input[name="fill-holes"]:checked')

        if (isBinaryImage && fill_holes) {
            applyObjectCounting(isBinaryImage.value, fill_holes.value);
        } else {
            alert("Por favor, identifique se a imagem é binária e se necessita de preenchimento de buracos.");
        }
    } else if (algoritmo === "Freeman") {
        applyFreemanChain();
    } else if (algoritmo === "Filtro-Box") {
        let kernel_size = parseInt(document.getElementById("filtro-kernel-size").value);

        if (kernel_size) {
            applyBoxFilter(kernel_size);
        } else {
            alert("Por favor, selecione o tamanho do kernel do filtro.")
        }

    } else if (algoritmo === "Reclassify-Pixels-Values") {
        applySegmentation();
    } else {
        alert("Por favor, selecione uma opcao válida.");
    }
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];

    if (file) {
        const imageURL = URL.createObjectURL(file);
        image.setAttribute('src', imageURL);

        image.onload = () => {
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
            imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
            imageInput.value = null;

            images_window.style.display = "flex";
            image.style.display = "block";
            grayImage.style.display = "none";
            binaryImage.style.display = "none";
            operatedImg.style.display = "none";
        };
    }
});


// --------------------------------------------------------------------------------------------------------
// FUNCOES AUXILIARES
// --------------------------------------------------------------------------------------------------------

// Converte uma imagem colorida para uma imagem em escala de cinza.
function imgToGrayscale(imageData) {
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];

        const gray = 0.299 * red + 0.587 * green + 0.114 * blue;

        data[i] = gray;      // Red
        data[i + 1] = gray;  // Green
        data[i + 2] = gray;  // Blue
    }
    return imageData;
}

// Converte uma imagem colorida para uma imagem binária (preto e branco).
function imgToBinary(imageData, threshold = 128) {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        // 0: preto (fundo) | 255: branco (objeto)
        const value = gray <= threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = value;
    }
    return imageData;
}

// Aplicar Filtro Gaussiano (Kernel 5x5). (Reduzir ruído).
function applyGaussianBlur(imageData_gray, width, height) {
    // Pixels centrais tem maior influencia.
    const kernel = [
        [1, 4, 7, 4, 1],
        [4, 16, 26, 16, 4],
        [7, 26, 41, 26, 7],
        [4, 16, 26, 16, 4],
        [1, 4, 7, 4, 1]
    ];
    const kernelSum = 273;
    return applyConvolutionFloat(imageData_gray, width, height, kernel, kernelSum);
}

// Aplicar convolução. Serve para aplicar os filtros sobre os pixels da imagem.
function applyConvolutionFloat(imageData, width, height, kernel, kernelSum) {
    const pixels = imageData.data;
    const output = new Float32Array(width * height); // 1 valor por pixel
    const kernelSize = kernel.length;
    const halfSize = Math.floor(kernelSize / 2);

    // Itera sobre a vizinhança definida pelo tamanho do kernel.
    // Para cada posição do kernel, multiplica o valor do pixel 
    // (considerando apenas o canal de intensidade) pelo valor correspondente no kernel.
    for (let y = halfSize; y < height - halfSize; y++) {
        for (let x = halfSize; x < width - halfSize; x++) {
            let sum = 0;
            for (let ky = -halfSize; ky <= halfSize; ky++) {
                for (let kx = -halfSize; kx <= halfSize; kx++) {
                    const i = ((y + ky) * width + (x + kx)) * 4;
                    // Soma os resultados dessas multiplicações.
                    sum += pixels[i] * kernel[ky + halfSize][kx + halfSize];
                }
            }
            const index = y * width + x;
            // Normaliza o filtro evidanto intensidades discrepantes.
            output[index] = sum / kernelSum;
        }
    }
    return { data: output, width, height };
}

// --------------------------------------------------------------------------------------------------------
// MARR-HILDRETH (DETECCAO DE BORDAS)
// --------------------------------------------------------------------------------------------------------
function applyMarrHildreth() {
    // Convertendo imagem para grayscale.
    let imageData_gray = imgToGrayscale(imageData);
    canvasContext.putImageData(imageData_gray, 0, 0);
    grayImage.setAttribute('src', canvas.toDataURL());
    grayImage.style.display = "block";

    // Filtro Gaussiano.
    const gaussianImage = applyGaussianBlur(imageData_gray, canvas.width, canvas.height);

    // Operador Laplaciano. (Laplaciano de Gaussiano).
    const laplacianImage = applyLaplacian(gaussianImage, canvas.width, canvas.height);

    // Detectando os zero-crossings (bordas).
    const edgeImage = detectZeroCrossings(laplacianImage, canvas.width, canvas.height);

    canvasContext.putImageData(edgeImage, 0, 0);
    operatedImg.setAttribute('src', canvas.toDataURL());
    operatedImg.style.display = "block";
}

// Aplicar Operador Laplaciano (Kernel 3x3). (Ressaltar regiões onde a intensidade da imagem muda abruptamente: bordas).
function applyLaplacian(imageData_gaussian, width, height) {
    // O centro negativo (-4) e os vizinhos positivos (1) ressaltam as regiões de mudança abrupta na imagem.
    const kernel = [
        [0, 1, 0],
        [1, -4, 1],
        [0, 1, 0]
    ];
    // Usa a convolução em float para manter os valores negativos para a deteccao de zero-crossings.
    return applyConvolutionFloat(imageData_gaussian, width, height, kernel, 1);
}

// Detectar zero-crossings. (Localização das bordas na imagem).
function detectZeroCrossings(laplacianImage, width, height) {
    const pixels = laplacianImage.data; // Float32Array com 1 valor por pixel.
    const output = new Uint8ClampedArray(width * height * 4);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = y * width + x;
            let hasPositive = false, hasNegative = false;
            // Para cada pixel da imagem verifica os 8 vizinhos.
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    if (kx === 0 && ky === 0) continue;
                    const neighborIndex = (y + ky) * width + (x + kx);
                    const neighborValue = pixels[neighborIndex];
                    // Verifica se dentre os vizinhos há pelo menos um valor positivo e outro negativo
                    // em torno do pixel central indicando uma borda.
                    if (neighborValue > 0) hasPositive = true;
                    if (neighborValue < 0) hasNegative = true;
                }
            }
            const outIndex = index * 4;
            // Se detecta borda o pixel recebece recebe valor 255.
            const edge = (hasPositive && hasNegative) ? 255 : 0;
            output[outIndex] = edge;
            output[outIndex + 1] = edge;
            output[outIndex + 2] = edge;
            output[outIndex + 3] = 255;
        }
    }
    return new ImageData(output, width, height);
}


// --------------------------------------------------------------------------------------------------------
// CANNY (DETECCAO DE BORDAS)
// --------------------------------------------------------------------------------------------------------
function applyCanny() {
    let imageData_gray = imgToGrayscale(imageData);
    canvasContext.putImageData(imageData_gray, 0, 0);
    grayImage.setAttribute("src", canvas.toDataURL());
    grayImage.style.display = "block";

    // Suavização com filtro Gaussiano.
    let blurredImage = applyGaussianBlur(imageData_gray, canvas.width, canvas.height);

    // Calcular gradientes usando operadores Sobel.
    let { magnitude, direction } = applySobel(blurredImage, canvas.width, canvas.height);

    // Supressão não-máxima para afinar as bordas.
    let nms = nonMaximumSuppression(magnitude, direction, canvas.width, canvas.height);

    // Dupla limiarização e histerese.
    let highThreshold = 40;
    let lowThreshold = 20;
    let finalEdges = applyHysteresis(nms, canvas.width, canvas.height, lowThreshold, highThreshold);

    // Convertendo o array final em ImageData.
    let outputData = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    for (let i = 0; i < finalEdges.length; i++) {
        let value = finalEdges[i];
        outputData[i * 4] = value;
        outputData[i * 4 + 1] = value;
        outputData[i * 4 + 2] = value;
        outputData[i * 4 + 3] = 255;
    }

    let outputImageData = new ImageData(outputData, canvas.width, canvas.height);
    canvasContext.putImageData(outputImageData, 0, 0);
    operatedImg.setAttribute("src", canvas.toDataURL());
    operatedImg.style.display = "block";
}

// Calcula os gradientes usando os filtros de Sobel (representam mudanças bruscas de intensidade, possíveis bordas).
function applySobel(imageData, width, height) {

    // Kernels de Sobel.
    // Cada pixel da imagem passa pela convolucao com esses kernels.
    const kernelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];
    const kernelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ];

    // Obtem Gx e Gy usando convolução em float
    let sobelX = applyConvolutionFloat(imageData, width, height, kernelX, 1);
    let sobelY = applyConvolutionFloat(imageData, width, height, kernelY, 1);

    // Magnitude do gradiente.
    let magnitude = new Float32Array(width * height);

    // Direcao da borda.
    let direction = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
        let gx = sobelX.data[i];
        let gy = sobelY.data[i];
        magnitude[i] = Math.hypot(gx, gy);
        direction[i] = Math.atan2(gy, gx);
    }

    return { magnitude, direction };
}

// Supressão não-máxima. (Mantendo apenas os picos das bordas).
function nonMaximumSuppression(magnitude, direction, width, height) {
    /*
        0° ou 180°: Comparação horizontal.
        45°: Comparação diagonal (\).
        90°: Comparação vertical.
        135°: Comparação diagonal (/).
    */

    let output = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let i = y * width + x;

            // Converte o ângulo para graus e normaliza para [0, 180).
            let angle = direction[i] * (180 / Math.PI);
            if (angle < 0) { angle += 180; }
            let mag = magnitude[i];
            let mag1 = 0, mag2 = 0;

            // Seleciona os vizinhos conforme a direção.
            if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
                // Horizontal: comparar com o pixel da esquerda e da direita.
                mag1 = magnitude[i - 1];
                mag2 = magnitude[i + 1];
            } else if (angle >= 22.5 && angle < 67.5) {
                // 45°: comparar com o pixel superior-direito e inferior-esquerdo.
                mag1 = magnitude[i - width + 1];
                mag2 = magnitude[i + width - 1];
            } else if (angle >= 67.5 && angle < 112.5) {
                // Vertical: comparar com o pixel acima e abaixo.
                mag1 = magnitude[i - width];
                mag2 = magnitude[i + width];
            } else if (angle >= 112.5 && angle < 157.5) {
                // 135°: comparar com o pixel superior-esquerdo e inferior-direito.
                mag1 = magnitude[i - width - 1];
                mag2 = magnitude[i + width + 1];
            }
            output[i] = (mag >= mag1 && mag >= mag2) ? mag : 0;
        }
    }
    return output;
}

// Aplicação da dupla limiarização e histerese para rastreamento de bordas com base nos limiares difinidos.
function applyHysteresis(nms, width, height, lowThreshold, highThreshold) {

    let result = new Uint8ClampedArray(width * height);

    // Classificação inicial: forte (255), fraco (75) ou não aresta (0).
    for (let i = 0; i < width * height; i++) {
        let val = nms[i];

        if (val >= highThreshold) {
            result[i] = 255;
        } else if (val >= lowThreshold) {
            result[i] = 75; // aresta fraca.
        } else {
            result[i] = 0;
        }
    }

    // Histerese: para cada pixel fraco, se houver pelo menos um vizinho forte, marque-o como forte, senão elimina-se.
    let changed = true;
    while (changed) {
        changed = false;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let i = y * width + x;
                if (result[i] === 75) {
                    let neighborStrong = false;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            if (kx === 0 && ky === 0) continue;
                            let ni = (y + ky) * width + (x + kx);
                            if (result[ni] === 255) {
                                neighborStrong = true;
                                break;
                            }
                        }
                        if (neighborStrong) break;
                    }
                    if (neighborStrong) {
                        result[i] = 255;
                        changed = true;
                    } else {
                        result[i] = 0;
                    }
                }
            }
        }
    }
    return result;
}

// --------------------------------------------------------------------------------------------------------
// MÉTODO DE OTSU
// --------------------------------------------------------------------------------------------------------

// Função para chamar o algoritmo e exibir a imagem processada.
function applyOtsu() {
    let imageData_gray = imgToGrayscale(imageData);
    canvasContext.putImageData(imageData_gray, 0, 0);
    grayImage.setAttribute('src', canvas.toDataURL());

    grayImage.style.display = "block";

    let otsuImage = applyOtsuMethod(imageData_gray);
    canvasContext.putImageData(otsuImage, 0, 0);
    operatedImg.setAttribute('src', canvas.toDataURL());
    operatedImg.style.display = "block";
}

// Aplica o método de Otsu para encontrar o melhor limiar e binarizar a imagem
function applyOtsuMethod(imageData) {
    let data = imageData.data;
    let width = imageData.width;
    let height = imageData.height;

    // Histograma.
    // Cada posição representa um nível de cinza de 0 a 255.
    // Conta a ocorrência de cada tom de cinza.
    let histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        let gray = data[i]; // Pegamos apenas o canal R (intensidade), pois a imagem já está em grayscale
        histogram[gray]++;
    }

    // Normalizar o histograma.
    let totalPixels = width * height;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i]; // Soma ponderada das intensidades.
    }

    // Calcular variância entre classes para cada possível limiar.
    let sumB = 0;           // Soma acumulada das intensidades da classe de fundo.
    let wB = 0;             // Peso da classe de fundo (número de pixels do fundo).
    let wF = 0;             // Peso da classe de objeto (número de pixels do objeto).
    let maxVariance = 0;    // Variância máxima entre classes encontrada.
    let threshold = 0;      // Limiar Otimo T.

    // Percorrer todos os limiares possíveis (0 a 255) para encontrar aquele que maximiza a variância entre classes.
    for (let t = 0; t < 256; t++) {
        wB += histogram[t]; // Peso da classe de fundo.
        if (wB === 0) continue;

        wF = totalPixels - wB; // Peso da classe de objeto.
        if (wF === 0) break;

        sumB += t * histogram[t];

        let mB = sumB / wB;         // Média da classe de fundo.
        let mF = (sum - sumB) / wF; // Média da classe de objeto.

        let varianceBetween = wB * wF * (mB - mF) ** 2;

        if (varianceBetween > maxVariance) {
            maxVariance = varianceBetween;
            threshold = t;
        }
    }

    console.log(`Limiar ótimo de Otsu encontrado: ${threshold}`);

    // Binarização com o limiar encontrado.
    for (let i = 0; i < data.length; i += 4) {
        let gray = data[i];
        let binaryValue = gray >= threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = binaryValue;
    }

    return imageData;
}


// --------------------------------------------------------------------------------------------------------
// WATERSHED
// --------------------------------------------------------------------------------------------------------

// Função para calcular o gradiente (usado para definir bordas no Watershed).
function computeGradient(imageData, width, height) {
    let data = imageData.data;
    let gradient = new Uint8ClampedArray(width * height * 4);

    // Percorre os pixels internos da imagem, ignorando bordas.
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let i = (y * width + x) * 4;
            let gx = data[i + 4] - data[i - 4];                 // Diferença horizontal.
            let gy = data[i + width * 4] - data[i - width * 4]; // Diferença vertical.
            let magnitude = Math.sqrt(gx * gx + gy * gy);       // Magnitude do gradiente.

            let index = (y * width + x) * 4;
            gradient[index] = magnitude;      // R
            gradient[index + 1] = magnitude;  // G
            gradient[index + 2] = magnitude;  // B
            gradient[index + 3] = 255;        // Alpha (opacidade total)
        }
    }

    // Imagem gradiente em tons de cinza com bordas mais claras.
    return new ImageData(gradient, width, height);
}

// Watershed.
function applyWatershedMethod(imageData) {
    let width = imageData.width;
    let height = imageData.height;

    // Converter para escala de cinza.
    let grayImage = imgToGrayscale(imageData);

    // Filtro de suavização para reduzir ruído.
    let blurredImage = applyGaussianBlur(grayImage, width, height);

    // Mapa de gradiente (borda).
    let gradientImage = computeGradient(blurredImage, width, height);

    // Criar um marcador inicial.
    let markers = new Uint8ClampedArray(width * height).fill(0);
    let data = gradientImage.data;

    // Se um pixel da imagem do gradiente for maior que 50, ele é marcado como borda (255).
    for (let i = 0; i < markers.length; i++) {
        if (data[i] > 50) {
            markers[i] = 255; // Marca bordas como regiões.
        }
    }

    // Aplica expansão das regiões ("Inundacao").
    let segmentedData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < markers.length; i++) {
        let val = markers[i];
        segmentedData[i * 4] = val;
        segmentedData[i * 4 + 1] = val;
        segmentedData[i * 4 + 2] = val;
        segmentedData[i * 4 + 3] = 255; // Alpha
    }

    return new ImageData(segmentedData, width, height);
}

// Função para chamar o algoritmo e exibir a imagem processada.
function applyWatershed() {
    let watershedImage = applyWatershedMethod(imageData);

    canvasContext.putImageData(watershedImage, 0, 0);
    operatedImg.setAttribute('src', canvas.toDataURL());
    operatedImg.style.display = "block";
}


// --------------------------------------------------------------------------------------------------------
// CONTADOR DE OBJETOS PARA IMAGENS BINÁRIAS
// --------------------------------------------------------------------------------------------------------

/*
* Assumimos que o objeto é preto (0) e o fundo é branco (255).
* A contagem é baseada na rotulagem de componentes conectados com 8-conectividade.
* Preenche os buracos em uma imagem binária para minimizar lacunas internas nos objetos.
*/

// Preenche buracos dentro dos objetos (áreas pretas cercadas por branco).
function fillHoles(imageData, width, height) {
    let data = imageData.data;

    // Array para marcar os pixels que fazem parte do fundo (conectados à borda).
    let visited = new Array(width * height).fill(false);

    // Função para obter o valor do pixel (considerando apenas o canal R).
    function getPixel(x, y) {
        let i = (y * width + x) * 4;
        return data[i];
    }

    // Função para definir o valor do pixel (todos os canais RGB).
    function setPixel(x, y, value) {
        let i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = value;
    }

    // Flood fill: Inicia a partir de todos os pixels da borda que são brancos (fundo).
    let stack = [];

    // Topo e fundo.
    for (let x = 0; x < width; x++) {
        if (getPixel(x, 0) === 255) stack.push({ x: x, y: 0 });
        if (getPixel(x, height - 1) === 255) stack.push({ x: x, y: height - 1 });
    }
    // Lados.
    for (let y = 0; y < height; y++) {
        if (getPixel(0, y) === 255) stack.push({ x: 0, y: y });
        if (getPixel(width - 1, y) === 255) stack.push({ x: width - 1, y: y });
    }

    // Processa o flood fill (4-conectividade).
    while (stack.length > 0) {
        let { x, y } = stack.pop();
        let index = y * width + x;
        if (visited[index]) continue;
        visited[index] = true;

        // Vizinhos: direita, esquerda, cima e baixo.
        const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];
        for (let d of directions) {
            let nx = x + d.dx;
            let ny = y + d.dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                let nIndex = ny * width + nx;
                if (!visited[nIndex] && getPixel(nx, ny) === 255) {
                    stack.push({ x: nx, y: ny });
                }
            }
        }
    }

    // Qualquer pixel branco que não esteja marcado (visited === false) é um buraco.
    // Todas as áreas brancas não conectadas à borda são buracos e são preenchidas com preto.
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let index = y * width + x;
            if (getPixel(x, y) === 255 && !visited[index]) {
                setPixel(x, y, 0);
            }
        }
    }

    return imageData;
}

// Rotulagem 8-Conectividade.
function countObjects(imageData, width, height) {
    let data = imageData.data;
    let labels = new Array(width * height).fill(0); // Matriz de rótulos.
    let labelCount = 1;                             // Inicia a contagem de rótulos.
    let equivalence = {};                           // Tabela para equivalência entre rótulos.

    // Função para encontrar o rótulo raiz (equivalências).
    function findRoot(label) {
        while (equivalence[label] !== undefined) {
            label = equivalence[label];
        }
        return label;
    }

    // Função que determina se o pixel faz parte do objeto (preto).
    function isObject(pixel) {
        return pixel < 128;
    }

    // Rotulagem dos componentes conectados com 8-conectividade.
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let i = (y * width + x) * 4; // Índice do pixel (usando apenas o canal Red).
            let pixelValue = data[i];

            if (isObject(pixelValue)) {
                let neighbors = [];
                // Vizinhos já processados (8-conectividade).
                if (x > 0) {
                    neighbors.push(labels[y * width + (x - 1)]);            // Esquerda.
                }
                if (y > 0) {
                    neighbors.push(labels[(y - 1) * width + x]);            // Acima.
                    if (x > 0) {
                        neighbors.push(labels[(y - 1) * width + (x - 1)]);  // Superior Esquerda.
                    }
                    if (x < width - 1) {
                        neighbors.push(labels[(y - 1) * width + (x + 1)]);  // Superior Direita.
                    }
                }
                let nonZeroNeighbors = neighbors.filter(label => label > 0);

                if (nonZeroNeighbors.length === 0) {
                    // Nenhum vizinho marcado: novo rótulo.
                    labels[y * width + x] = labelCount;
                    labelCount++;
                } else {
                    // Usa o menor rótulo dentre os vizinhos encontrados.
                    let minLabel = Math.min(...nonZeroNeighbors);
                    labels[y * width + x] = minLabel;

                    // Registra equivalências entre os rótulos vizinhos.
                    for (let neighbor of nonZeroNeighbors) {
                        if (neighbor !== minLabel) {
                            equivalence[neighbor] = minLabel;
                        }
                    }
                }
            }
        }
    }

    // Resolver equivalências e contar os rótulos únicos.
    let uniqueLabels = new Set();
    for (let i = 0; i < labels.length; i++) {
        if (labels[i] > 0) {
            uniqueLabels.add(findRoot(labels[i]));
        }
    }

    console.log("Número de objetos detectados:", uniqueLabels.size);
    return uniqueLabels.size;
}

// Contador de Objetos.
function applyObjectCounting(isBinaryImage, fillHolesOption) {

    // Se a imagem não for binária, converte para grayscale e depois para binário.
    let processedImage = isBinaryImage === "not-binary-image" ?
        applyOtsuMethod(imgToGrayscale(imageData)) : imageData;

    if (isBinaryImage === "not-binary-image") {
        canvasContext.putImageData(processedImage, 0, 0);
        binaryImage.setAttribute("src", canvas.toDataURL());
        binaryImage.style.display = "block";
    }

    // Preenche os buracos, se a opção estiver ativada.
    if (fillHolesOption === "true") {
        processedImage = fillHoles(processedImage, canvas.width, canvas.height);
    }

    // Atualiza o canvas e a imagem exibida (para visualização do resultado).
    canvasContext.putImageData(processedImage, 0, 0);
    operatedImg.setAttribute("src", canvas.toDataURL());
    operatedImg.style.display = "block";

    // Conta os objetos e exibe o resultado.
    let numObjects = countObjects(processedImage, canvas.width, canvas.height);
    alert(`Número de objetos detectados: ${numObjects}`);
    return numObjects;
}


// --------------------------------------------------------------------------------------------------------
// CADEIA DE FREEMAN: OBJETO BRANCO E FUNDO PRETO
// --------------------------------------------------------------------------------------------------------

// Cadeia de Freeman para uma imagem binária.
function chainFreeman(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Função auxiliar para obter o valor do pixel (usando o canal R).
    function getPixel(x, y) {
        return data[(y * width + x) * 4];
    }

    // Função auxiliar para criar chave única para cada pixel (usado para controlar os visitados).
    function key(x, y) {
        return `${x},${y}`;
    }

    // Encontra o primeiro pixel branco (255) na imagem (assumindo que o objeto está em branco).
    // Percorre a imagem pixel a pixel da esquerda para a direita e de cima para baixo, 
    // encontrando o primeiro pixel branco (255), que será o ponto de partida do contorno.
    let pontoInicial = null;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (getPixel(x, y) === 255) {
                pontoInicial = { x: x, y: y };
                break;
            }
        }
        if (pontoInicial !== null) break;
    }
    if (pontoInicial === null) return []; // Nenhum contorno encontrado.

    // Define os 8 movimentos da cadeia de Freeman (ordem: 0 a 7).
    const movimentos = [
        { dx: 1, dy: 0 },   // 0: direita.
        { dx: 1, dy: -1 },  // 1: diagonal superior direita.
        { dx: 0, dy: -1 },  // 2: cima.
        { dx: -1, dy: -1 }, // 3: diagonal superior esquerda.
        { dx: -1, dy: 0 },  // 4: esquerda.
        { dx: -1, dy: 1 },  // 5: diagonal inferior esquerda.
        { dx: 0, dy: 1 },   // 6: baixo.
        { dx: 1, dy: 1 }    // 7: diagonal inferior direita.
    ];

    // Armazena a cadeia de direções, os pixels já visitados e inicializa o ponto de partida.
    let cadeia = [];                // Armazena os índices dos movimentos.
    let visitado = new Set();       // Armazena os pixels visitados.
    let { x, y } = pontoInicial;
    visitado.add(key(x, y));
    let primeiroPasso = true;

    // Loop que percorre a borda seguindo os movimentos da cadeia.
    // Tenta encontrar um pixel vizinho branco para continuar o contorno.
    while (true) {
        let encontrado = false;

        // Percorre todas as 8 direções.
        for (let i = 0; i < movimentos.length; i++) {
            let nx = x + movimentos[i].dx;
            let ny = y + movimentos[i].dy;

            // Verifica se o novo pixel está dentro dos limites, ainda não foi visitado e é branco (parte do objeto).
            if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                !visitado.has(key(nx, ny)) && getPixel(nx, ny) === 255) {
                cadeia.push(i);               // Registra o movimento.
                visitado.add(key(nx, ny));    // Marca o pixel como visitado.
                x = nx;
                y = ny;
                encontrado = true;
                break;
            }
        }

        // Se nenhum vizinho válido foi encontrado, encerra o loop.
        if (!encontrado) break;

        // Se retornou ao ponto inicial (após o primeiro movimento), encerra o laço.
        if (x === pontoInicial.x && y === pontoInicial.y && !primeiroPasso) break;

        primeiroPasso = false;
    }

    return cadeia;
}

// Função para aplicar a Cadeia de Freeman usando a imagem atual.
function applyFreemanChain() {
    let imageData_gray = imgToGrayscale(imageData);

    canvasContext.putImageData(imageData_gray, 0, 0);
    grayImage.setAttribute('src', canvas.toDataURL());
    grayImage.style.display = "block";

    let imageData_binary = imgToBinary(imageData_gray, 128);

    canvasContext.putImageData(imageData_binary, 0, 0);
    binaryImage.setAttribute('src', canvas.toDataURL());
    binaryImage.style.display = "block";

    // Calcula a cadeia de Freeman
    let cadeia = chainFreeman(imageData_binary);
    console.log("Cadeia de Freeman:", cadeia);

    // Exibe o resultado (pode ser ajustado para exibir de outra forma)
    alert("Código da Cadeia de Freeman: " + (cadeia.length > 0 ? cadeia.join(", ") : "Nenhum contorno detectado."));
}


// --------------------------------------------------------------------------------------------------------
// FILTRO BOX (Filtro de Média)
// --------------------------------------------------------------------------------------------------------

// Função de convolução modificada o Filtro Box suportar kernels de tamanho par e ímpar.
function applyConvolutionFloat(imageData, width, height, kernel, kernelSum) {
    const pixels = imageData.data;
    const output = new Float32Array(width * height);
    const kernelSize = kernel.length;

    // Calcula o deslocamento: para kernel par, offset = kernelSize/2, para ímpar, floor(kernelSize/2).
    const offset = Math.floor(kernelSize / 2);

    // Calcula a margem direita/inferior: para kernel par, boundary = kernelSize - offset - 1; para ímpar, igual a offset.
    const boundary = kernelSize - offset - 1;

    for (let y = offset; y < height - boundary; y++) {
        for (let x = offset; x < width - boundary; x++) {
            let sum = 0;
            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {

                    // Índice do pixel ajustado para centralizar o kernel.
                    const ix = x + kx - offset;
                    const iy = y + ky - offset;
                    const i = (iy * width + ix) * 4;

                    sum += pixels[i] * kernel[ky][kx];
                }
            }
            output[y * width + x] = sum / kernelSum;
        }
    }
    return { data: output, width, height };
}

// Função para construir um kernel Box de tamanho kernelSize x kernelSize.
function buildBoxKernel(kernelSize) {
    const kernel = [];
    for (let i = 0; i < kernelSize; i++) {
        const row = [];
        for (let j = 0; j < kernelSize; j++) {
            row.push(1);
        }
        kernel.push(row);
    }
    return kernel;
}

// Aplica o filtro Box a uma imagem em escala de cinza usando o kernel fornecido.
function applyBoxFilterWithKernelSize(imageData, width, height, kernelSize) {
    const kernel = buildBoxKernel(kernelSize);
    const kernelSum = kernelSize * kernelSize;

    // Aplica a convolução utilizando a função modificada.
    const output = applyConvolutionFloat(imageData, width, height, kernel, kernelSum);

    // Converte o resultado (Float32Array) para ImageData (Uint8ClampedArray).
    const resultData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const value = output.data[i];
        resultData[i * 4] = value;
        resultData[i * 4 + 1] = value;
        resultData[i * 4 + 2] = value;
        resultData[i * 4 + 3] = 255;
    }

    return new ImageData(resultData, width, height);
}

// Filtro Box com o tamanho desejado (2x2, 3x3, 5x5 ou 7x7).
function applyBoxFilter(kernelSize) {
    let imageData_gray = imgToGrayscale(imageData);

    // Aplica o filtro Box.
    const filteredImage = applyBoxFilterWithKernelSize(imageData_gray, canvas.width, canvas.height, kernelSize);

    canvasContext.putImageData(filteredImage, 0, 0);
    operatedImg.setAttribute("src", canvas.toDataURL());
    operatedImg.style.display = "block";

    alert(`Filtro Box ${kernelSize}x${kernelSize} aplicado com sucesso.`);
}


// --------------------------------------------------------------------------------------------------------
// RECLASSIFICACAO DOS VALORES DOS PIXELS BASEADOS EM INTENSIDADE
// --------------------------------------------------------------------------------------------------------

// Função para segmentação por transformação de intensidade.
function applyIntensitySegmentation(imageData) {
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        let gray = data[i]; // Pegamos apenas um dos canais (R, G ou B, pois já é grayscale).
        let newGray = 0;

        // Aplica a tabela de transformação de intensidade.
        if (gray >= 0 && gray <= 50) newGray = 25;
        else if (gray >= 51 && gray <= 100) newGray = 75;
        else if (gray >= 101 && gray <= 150) newGray = 125;
        else if (gray >= 151 && gray <= 200) newGray = 175;
        else if (gray >= 201 && gray <= 255) newGray = 255;

        // Define o novo valor nos três canais RGB.
        data[i] = data[i + 1] = data[i + 2] = newGray;
    }

    return imageData;
}

// Função principal para aplicar a segmentação e exibir a imagem processada.
function applySegmentation() {
    let imageData_gray = imgToGrayscale(imageData);
    canvasContext.putImageData(imageData_gray, 0, 0);
    grayImage.setAttribute('src', canvas.toDataURL());
    grayImage.style.display = "block";

    let segmentedImage = applyIntensitySegmentation(imgToGrayscale(imageData));
    canvasContext.putImageData(segmentedImage, 0, 0);
    operatedImg.setAttribute("src", canvas.toDataURL());
    operatedImg.style.display = "block";
}