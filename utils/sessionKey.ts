
let key: CryptoKey | null = null;

/**
 * Define a chave de criptografia da sessão global.
 * @param newKey A CryptoKey para a sessão atual, ou nulo para limpá-la.
 */
export const setSessionKey = (newKey: CryptoKey | null) => {
    key = newKey;
};

/**
 * Recupera a chave de criptografia da sessão global.
 * @returns A CryptoKey da sessão atual, ou nulo se não estiver definida.
 */
export const getSessionKey = (): CryptoKey | null => {
    return key;
};
