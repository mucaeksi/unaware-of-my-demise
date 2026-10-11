/** CSPRNG roll in [0, 1) with 53 bits of precision. Server-side randomness (pulls, drops, stat rolls) never uses Math.random or a client value. */
export const cryptoRoll = (): number => {
  const [hi, lo] = crypto.getRandomValues(new Uint32Array(2)) as Uint32Array & [number, number];
  return ((hi >>> 5) * 67108864 + (lo >>> 6)) / 9007199254740992;
};
