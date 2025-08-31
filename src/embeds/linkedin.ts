export function linkedin(urn: string) {
  return `
  <div style="display: flex; justify-content: center;">
     <iframe src="https://www.linkedin.com/embed/feed/update/${urn}?collapsed=1" height="582" width="504" frameborder="0" allowfullscreen="" title="Embedded post"></iframe>
  </div>
`;
}
