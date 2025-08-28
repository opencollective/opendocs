export function youtube(id: string) {
  return `
     <div
      class="video full-width"
      style="
        position: relative;
        padding-bottom: 56.25%;
        padding-top: 0.25em;
        height: 0;
      "
    >
      <iframe
        style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        "
        src="https://www.youtube.com/embed/${id}"
        frameborder="0"
        allowfullscreen
      ></iframe>
    </div>`;
}
