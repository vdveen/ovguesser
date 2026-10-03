/** True on phones and tablets, where copy says "tik" instead of "klik" and keyboard hints are hidden. */
export const isTouch = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
