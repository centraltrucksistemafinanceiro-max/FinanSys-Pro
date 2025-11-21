
// Este arquivo contém toda a lógica da API Web Crypto para criptografia em repouso.

/**
 * Deriva uma chave criptográfica de uma senha e um salt usando PBKDF2.
 * @param password A senha do usuário.
 * @param salt Uma string codificada em hexadecimal para o salt.
 * @returns Uma promessa que resolve para uma CryptoKey para criptografia AES-GCM.
 */
export const deriveKey = async (password: string, salt: string): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    // O salt é armazenado como hex, precisa ser convertido para um buffer.
    const saltBuffer = new Uint8Array(salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

// Auxiliar para converter um Uint8Array para uma string Base64.
const toBase64 = (buffer: Uint8Array): string => {
    // A conversão via `fromCharCode` pode falhar com buffers grandes. Uma abordagem mais robusta seria necessária para arquivos muito grandes, mas para objetos JSON é suficiente.
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
};

// Auxiliar para converter uma string Base64 de volta para um Uint8Array.
const fromBase64 = (base64: string): Uint8Array => {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
};

/**
 * Criptografa um objeto JavaScript. O objeto deve ter uma propriedade `id`.
 * Propriedades indexadas como `companyId` são preservadas em texto plano.
 * @param data O objeto a ser criptografado.
 * @param key A CryptoKey a ser usada para a criptografia.
 * @returns Uma promessa que resolve para um objeto com índices em texto plano e um payload criptografado.
 */
export const encrypt = async (data: any, key: CryptoKey): Promise<any> => {
    // Previne a dupla criptografia. Se o objeto já estiver no formato criptografado, retorna-o como está.
    if (typeof data.payload === 'string') {
        return data;
    }
    if (!data.id) throw new Error('Os dados devem ter um id para serem criptografados.');

    const encoder = new TextEncoder();
    const dataString = JSON.stringify(data);
    const dataBuffer = encoder.encode(dataString);
    
    // O IV (Vetor de Inicialização) deve ser único para cada criptografia com a mesma chave.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
    );
    
    // Combina IV e texto cifrado em uma única string para armazenamento.
    const encryptedPayload = `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;

    // Preserva o id e os campos indexados em texto plano para consulta.
    const encryptedObject: { id: string; companyId?: string; payload: string } = {
        id: data.id,
        payload: encryptedPayload,
    };
    if (data.companyId) {
        encryptedObject.companyId = data.companyId;
    }

    return encryptedObject;
};

/**
 * Descriptografa dados e reconstrói o objeto JavaScript.
 * @param encryptedData Um objeto com um `payload` criptografado.
 * @param key A CryptoKey a ser usada para a descriptografia.
 * @returns Uma promessa que resolve para o objeto original descriptografado.
 */
export const decrypt = async (encryptedData: any, key: CryptoKey): Promise<any> => {
    // Se não houver payload, é um objeto não criptografado. Retorna como está.
    // A lógica de "lazy write" em db.ts cuidará de criptografá-lo.
    if (typeof encryptedData.payload !== 'string') {
        return encryptedData;
    }

    const [ivBase64, ciphertextBase64] = encryptedData.payload.split('.');
    if (!ivBase64 || !ciphertextBase64) {
        throw new Error('Formato de payload criptografado inválido.');
    }
    
    const iv = fromBase64(ivBase64);
    const ciphertext = fromBase64(ciphertextBase64);

    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        const decryptedString = decoder.decode(decryptedBuffer);
        return JSON.parse(decryptedString);
    } catch (error) {
        console.error('Falha na descriptografia. Isso pode ser devido a uma senha incorreta ou dados corrompidos.', error);
        throw new Error('Falha na descriptografia.');
    }
};
