import { createElement } from "lucide";

/**
 * Cria um <svg> a partir de um ícone do lucide.
 *   import { Plus } from "lucide";
 *   icon(Plus)             // decorativo (aria-hidden)
 *   icon(Plus, { size: 24, label: "Adicionar" })
 */
export function icon(no, { size, label, className, strokeWidth } = {}) {
    const attrs = {};
    if (size) {
        attrs.width = size;
        attrs.height = size;
    }
    if (strokeWidth) attrs["stroke-width"] = strokeWidth;
    if (className) attrs.class = className;

    const svg = createElement(no, attrs);
    if (label) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", label);
    } else {
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
    }
    return svg;
}
