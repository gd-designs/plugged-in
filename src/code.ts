// Show the plugin UI
figma.showUI(__html__, { width: 800, height: 800 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "process-frame") {
    const selection = figma.currentPage.selection;

    if (selection.length === 0 || selection[0].type !== "FRAME") {
      figma.ui.postMessage({
        type: "error",
        message: "Please select a frame to process.",
      });
      return;
    }

    const frame = selection[0] as FrameNode;
    const fontsUsed = new Set<string>();

    // Function to collect fonts from "Body" children
    function collectFontsFromBody(node: BaseNode) {
      if (node.type === "FRAME" || node.type === "GROUP") {
        node.children.forEach((child) => {
          if (child.name === "Body" && "children" in child) {
            child.children.forEach((bodyChild) => {
              if (bodyChild.type === "TEXT") {
                const textNode = bodyChild as TextNode;
                const fontName = textNode.fontName;
                if (typeof fontName === "object") {
                  fontsUsed.add(`${fontName.family} ${fontName.style}`);
                }
              }
            });
          }
        });
      }
    }

    // Start collecting fonts from the frame
    collectFontsFromBody(frame);

    // Convert the set to an array and join into a string
    const fontsList = Array.from(fontsUsed).join(", ");

    // Send the fonts list back to the UI
    figma.ui.postMessage({
      type: "fonts-used",
      fonts: fontsList,
    });

    console.log("Fonts used:", fontsList);

    const children = frame.children;
    console.log("Frame children:", children);

    const html = children
      .map((child) => {
        if (child.name === "Artboard") {
          return `<div id="${child.name}"><a href="#"><img src="https://cdn.prod.website-files.com/67374e418f3dea04e00ad1e9/673756cfd9a8282cf25969d9_6191a88a1c0e39463c2bf022_placeholder-image.svg" alt="Placeholder Image" /></a></div>`;
        } else if (child.name === "Body") {
          // Extract styles from the Body node
          const bodyStyles = extractStyles(child as FrameNode);

          // Capture child text elements of Body
          const bodyContent = extractBodyContent(child as FrameNode);

          return `<div id="${child.name}" style="${bodyStyles}">${bodyContent}</div>`;
        } else {
          return `<div id="${child.name}"></div>`;
        }
      })
      .join("\n");

    figma.ui.postMessage({
      type: "update-highlighted-content",
      content: html,
    });

    console.log("Generated HTML:", html);
  } else if (msg.type === "cancel") {
    figma.closePlugin();
  }
};

// Function to extract styles from a node and convert them to inline CSS
function extractStyles(node: FrameNode | GroupNode): string {
  if (node.type !== "FRAME" && node.type !== "GROUP") return "";
  if (node.type === "FRAME") {
    const layoutMode =
      node.layoutMode === "NONE" ? "" : node.layoutMode.toLowerCase();
    const justifyContent = node.primaryAxisAlignItems || "";
    const alignItems = node.counterAxisAlignItems || "";
    const gap = node.itemSpacing || 0;
    const padding = `${node.paddingTop || 0}px ${node.paddingRight || 0}px ${
      node.paddingBottom || 0
    }px ${node.paddingLeft || 0}px`;
    const backgroundColor =
      Array.isArray(node.fills) &&
      node.fills[0] &&
      node.fills[0].type === "SOLID"
        ? `#${Math.round(node.fills[0].color.r * 255)
            .toString(16)
            .padStart(2, "0")}${Math.round(node.fills[0].color.g * 255)
            .toString(16)
            .padStart(2, "0")}${Math.round(node.fills[0].color.b * 255)
            .toString(16)
            .padStart(2, "0")}`
        : "";

    const styles = [
      layoutMode ? `display: ${layoutMode};` : "",
      justifyContent ? `justify-content: ${justifyContent.toLowerCase()};` : "",
      alignItems ? `align-items: ${alignItems.toLowerCase()};` : "",
      gap ? `gap: ${gap}px;` : "",
      `padding: ${padding};`,
      backgroundColor ? `background-color: ${backgroundColor};` : "",
    ];

    return styles.filter(Boolean).join(" ");
  }
  return "";
}

// Function to extract the text content of child elements of the Body node
function extractBodyContent(bodyNode: FrameNode): string {
  if (!("children" in bodyNode)) return "";

  const childTextElements = bodyNode.children
    .filter((child) => child.type === "TEXT") // Only process text elements
    .map((textNode) => {
      const overallStyles = extractTextStyles(textNode as TextNode);
      const formattedContent = extractFormattedText(
        textNode as TextNode,
        overallStyles
      );
      return `<p style="${overallStyles}">${formattedContent}</p>`;
    });

  return childTextElements.join("\n");
}

// Function to process a TextNode and generate the full paragraph with spans if needed
function processTextNode(node: TextNode): string {
  const resolvedStyles = extractTextStyles(node); // Extract resolved paragraph-level styles
  const formattedContent = extractFormattedText(node, resolvedStyles); // Handle spans for mixed styles

  // Check if the formatted content contains a span
  const containsSpan = formattedContent.includes("<span");

  // Remove font-weight from paragraph styles if it contains a span
  const paragraphStyles = containsSpan
    ? resolvedStyles.replace(/font-weight: [^;]+;/, "")
    : resolvedStyles;

  // Return the paragraph with resolved styles and formatted content
  return `<p style="${paragraphStyles}">${formattedContent}</p>`;
}

// Function to extract styles from a text node (for the paragraph level)
function extractTextStyles(node: TextNode): string {
  let fontSize = node.fontSize || "";
  let fontWeight = node.fontWeight || "";

  // Resolve mixed fontWeight and fontSize by setting them to empty if they are mixed
  if (fontWeight === Symbol("figma.mixed")) {
    fontWeight = ""; // Set to empty to avoid invalid HTML
  }

  if (fontSize === Symbol("figma.mixed")) {
    fontSize = ""; // Set to empty to avoid invalid HTML
  }

  const fontColor =
    Array.isArray(node.fills) && node.fills[0] && node.fills[0].type === "SOLID"
      ? `#${Math.round((node.fills[0] as SolidPaint).color.r * 255)
          .toString(16)
          .padStart(2, "0")}${Math.round(
          (node.fills[0] as SolidPaint).color.g * 255
        )
          .toString(16)
          .padStart(2, "0")}${Math.round(
          (node.fills[0] as SolidPaint).color.b * 255
        )
          .toString(16)
          .padStart(2, "0")}`
      : "";

  const lineHeight =
    node.lineHeight && typeof node.lineHeight === "number"
      ? `${node.lineHeight}px`
      : "";

  const textAlign =
    node.textAlignHorizontal && typeof node.textAlignHorizontal === "string"
      ? node.textAlignHorizontal.toLowerCase()
      : "";

  const fontStyle =
    node.fontName && typeof node.fontName === "object" && node.fontName.style
      ? node.fontName.style.toLowerCase()
      : "";

  const styles = [
    fontSize && fontSize !== Symbol("figma.mixed")
      ? `font-size: ${String(fontSize)}px;`
      : "",
    fontWeight && fontWeight !== Symbol("figma.mixed")
      ? `font-weight: ${String(fontWeight)};`
      : "",
    fontColor ? `color: ${fontColor};` : "",
    lineHeight ? `line-height: ${lineHeight};` : "",
    textAlign ? `text-align: ${textAlign};` : "",
    fontStyle ? `font-style: ${fontStyle};` : "",
  ];

  return styles.filter(Boolean).join(" ");
}

// Helper function to resolve the most common font-weight in a TextNode
function resolveMixedFontWeight(node: TextNode): string {
  const fontWeights: Record<string, number> = {};
  const characters = node.characters;

  for (let i = 0; i < characters.length; i++) {
    const weight = String(node.getRangeFontWeight(i, i + 1));
    fontWeights[weight] = (fontWeights[weight] || 0) + 1;
  }

  // Find the most common font-weight
  return Object.keys(fontWeights).reduce((a, b) =>
    fontWeights[a] > fontWeights[b] ? a : b
  );
}

// Function to extract formatted text with spans for varying styles
function extractFormattedText(node: TextNode, resolvedStyles: string): string {
  const characters = node.characters;
  let formattedText = "";

  let i = 0;
  while (i < characters.length) {
    // Get the styles for the current character range
    const fontName = node.getRangeFontName(i, i + 1) as FontName;
    const fontStyle = fontName.style.toLowerCase();
    const fontWeight = node.getRangeFontWeight(i, i + 1);
    const fontSize = node.getRangeFontSize(i, i + 1);
    const fills = node.getRangeFills(i, i + 1);
    const fontColor =
      Array.isArray(fills) && fills[0] && fills[0].type === "SOLID"
        ? `#${Math.round((fills[0] as SolidPaint).color.r * 255)
            .toString(16)
            .padStart(2, "0")}${Math.round(
            (fills[0] as SolidPaint).color.g * 255
          )
            .toString(16)
            .padStart(2, "0")}${Math.round(
            (fills[0] as SolidPaint).color.b * 255
          )
            .toString(16)
            .padStart(2, "0")}`
        : "";

    // Check for text decoration (underline)
    const textDecoration = node.getRangeTextDecoration(i, i + 1);

    // Find the range where the font style, size, weight, and decoration are consistent
    let j = i + 1;
    while (
      j < characters.length &&
      JSON.stringify(fontName) ===
        JSON.stringify(node.getRangeFontName(j, j + 1)) &&
      fontWeight === node.getRangeFontWeight(j, j + 1) &&
      fontSize === node.getRangeFontSize(j, j + 1) &&
      JSON.stringify(node.getRangeFills(j, j + 1)) === JSON.stringify(fills) &&
      textDecoration === node.getRangeTextDecoration(j, j + 1)
    ) {
      j++;
    }

    const textSegment = characters.slice(i, j);

    // Build span only if styles differ from resolved paragraph-level styles
    const spanStyles = [];
    if (
      String(fontWeight) !== resolvedStyles.match(/font-weight: ([0-9]+);/)?.[1]
    ) {
      spanStyles.push(`font-weight: ${String(fontWeight)};`);
    }
    if (
      `${String(fontSize)}px` !==
      resolvedStyles.match(/font-size: ([0-9]+px);/)?.[1]
    ) {
      spanStyles.push(`font-size: ${String(fontSize)}px;`);
    }
    if (fontColor !== resolvedStyles.match(/color: (#[a-f0-9]{6});/)?.[1]) {
      spanStyles.push(`color: ${fontColor};`);
    }
    if (fontStyle !== resolvedStyles.match(/font-style: ([a-z]+);/)?.[1]) {
      spanStyles.push(`font-style: ${fontStyle};`);
    }
    if (textDecoration === "UNDERLINE") {
      spanStyles.push(`text-decoration: underline;`);
    }

    let spanContent = textSegment;
    if (spanStyles.length > 0) {
      spanContent = `<span style="${spanStyles.join(
        " "
      )}">${textSegment}</span>`;
    }

    // Wrap in a link if underlined, preserving the font color
    if (textDecoration === "UNDERLINE") {
      formattedText += `<a href="#" style="text-decoration: none; color: ${fontColor};">${spanContent}</a>`;
    } else {
      formattedText += spanContent;
    }

    i = j; // Move to the next segment
  }

  return formattedText.replace(/\n/g, "<br />"); // Replace line breaks with <br />
}
