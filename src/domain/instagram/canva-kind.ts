/**
 * Rangement des modèles Canva par format (demande de Cédric, 2026-11-10 : « les posts simples sont dans Post, les
 * carrousels dans Carrousel, pour ne pas confondre »). L'API Canva ne donne pas le nombre de pages d'un modèle : le
 * nom fait foi. Un modèle dont le nom contient « carrousel » (ou « carousel ») est un carrousel ; les autres, des posts.
 */
export type CanvaKind = "simple" | "carrousel";
export const CAROUSEL_NAME = /carr?ou?sel/i;
export const canvaKind = (title: string): CanvaKind => (CAROUSEL_NAME.test(title.normalize("NFD").replace(/\p{M}/gu, "")) ? "carrousel" : "simple");
