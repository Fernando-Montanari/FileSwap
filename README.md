# Conversor Universal de Arquivos

Uma aplicação web estática simples, elegante e eficaz para converter arquivos entre os formatos **CSV, JSON, XML e XLSX**.

Esta aplicação processa tudo inteiramente no lado do cliente (no seu navegador), o que significa que seus arquivos não são enviados para nenhum servidor. 

## Como hospedar de graça no GitHub Pages

Como esta aplicação usa apenas HTML, CSS e JavaScript (Vanilla), você pode hospedá-la gratuitamente no GitHub Pages seguindo estes passos:

1. Faça o commit e o push destes arquivos (`index.html`, `style.css`, `script.js` e `README.md`) para o seu repositório no GitHub.
2. Vá até a página do seu repositório no GitHub.
3. Clique na aba **"Settings"** (Configurações).
4. No menu lateral esquerdo, clique em **"Pages"**.
5. Na seção "Build and deployment", em "Source", selecione **"Deploy from a branch"**.
6. Logo abaixo, em "Branch", selecione a branch `main` (ou `master`) e mantenha a pasta como `/ (root)`.
7. Clique em **"Save"**.
8. Aguarde alguns minutos e um link para o seu site aparecerá no topo da mesma página.

## Tecnologias Usadas
- Vanilla JS, HTML5, CSS3
- [SheetJS (xlsx)](https://sheetjs.com/) - Manipulação de XLSX.
- [PapaParse](https://www.papaparse.com/) - Processamento rápido de CSV.
- [x2js](https://github.com/abdolence/x2js) - Conversão entre XML e JSON.