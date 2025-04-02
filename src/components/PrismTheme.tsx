import { useEffect } from 'react';

// Custom CSS for Prism themes
const prismLightTheme = `
/* Light theme - based on prism.css */
code.prism-light {
  color: black;
  background: none;
  text-shadow: 0 1px white;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
  tab-size: 4;
  hyphens: none;
}

code.prism-light .token.comment,
code.prism-light .token.prolog,
code.prism-light .token.doctype,
code.prism-light .token.cdata {
  color: slategray;
}

code.prism-light .token.punctuation {
  color: #999;
}

code.prism-light .token.namespace {
  opacity: .7;
}

code.prism-light .token.property,
code.prism-light .token.tag,
code.prism-light .token.boolean,
code.prism-light .token.number,
code.prism-light .token.constant,
code.prism-light .token.symbol,
code.prism-light .token.deleted {
  color: #905;
}

code.prism-light .token.selector,
code.prism-light .token.attr-name,
code.prism-light .token.string,
code.prism-light .token.char,
code.prism-light .token.builtin,
code.prism-light .token.inserted {
  color: #690;
}

code.prism-light .token.operator,
code.prism-light .token.entity,
code.prism-light .token.url,
code.prism-light .language-css .token.string,
code.prism-light .style .token.string {
  color: #9a6e3a;
}

code.prism-light .token.atrule,
code.prism-light .token.attr-value,
code.prism-light .token.keyword {
  color: #07a;
}

code.prism-light .token.function,
code.prism-light .token.class-name {
  color: #DD4A68;
}

code.prism-light .token.regex,
code.prism-light .token.important,
code.prism-light .token.variable {
  color: #e90;
}
`;

const prismDarkTheme = `
/* Dark theme - based on prism-tomorrow.css */
code.prism-dark {
  color: #ccc;
  background: none;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
  tab-size: 4;
  hyphens: none;
}

code.prism-dark .token.comment,
code.prism-dark .token.block-comment,
code.prism-dark .token.prolog,
code.prism-dark .token.doctype,
code.prism-dark .token.cdata {
  color: #999;
}

code.prism-dark .token.punctuation {
  color: #ccc;
}

code.prism-dark .token.tag,
code.prism-dark .token.attr-name,
code.prism-dark .token.namespace,
code.prism-dark .token.deleted {
  color: #e2777a;
}

code.prism-dark .token.function-name {
  color: #6196cc;
}

code.prism-dark .token.boolean,
code.prism-dark .token.number,
code.prism-dark .token.function {
  color: #f08d49;
}

code.prism-dark .token.property,
code.prism-dark .token.class-name,
code.prism-dark .token.constant,
code.prism-dark .token.symbol {
  color: #f8c555;
}

code.prism-dark .token.selector,
code.prism-dark .token.important,
code.prism-dark .token.atrule,
code.prism-dark .token.keyword,
code.prism-dark .token.builtin {
  color: #cc99cd;
}

code.prism-dark .token.string,
code.prism-dark .token.char,
code.prism-dark .token.attr-value,
code.prism-dark .token.regex,
code.prism-dark .token.variable {
  color: #7ec699;
}

code.prism-dark .token.operator,
code.prism-dark .token.entity,
code.prism-dark .token.url {
  color: #67cdcc;
}

code.prism-dark .token.important,
code.prism-dark .token.bold {
  font-weight: bold;
}

code.prism-dark .token.italic {
  font-style: italic;
}

code.prism-dark .token.entity {
  cursor: help;
}

code.prism-dark .token.inserted {
  color: green;
}
`;

export const usePrismTheme = (isDarkMode: boolean) => {
  useEffect(() => {
    // Remove any existing styles
    const existingStyles = document.getElementById('prism-theme-styles');
    if (existingStyles) {
      document.head.removeChild(existingStyles);
    }

    // Create style element for Prism themes
    const styleElement = document.createElement('style');
    styleElement.id = 'prism-theme-styles';
    // Combine both Prism themes
    styleElement.textContent = `
      ${prismLightTheme}
      ${prismDarkTheme}
    `;

    // Add to document
    document.head.appendChild(styleElement);

    return () => {
      // Clean up on unmount
      const styleElement = document.getElementById('prism-theme-styles');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  return {
    codeClassName: isDarkMode ? 'prism-dark' : 'prism-light'
  };
};

export default usePrismTheme;
