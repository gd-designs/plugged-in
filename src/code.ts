// Show the plugin UI
figma.showUI(__html__, { width: 800, height: 800 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "process-frame") {
    const selection = figma.currentPage.selection;

    if (selection.length === 0 || selection[0].type !== "SECTION") {
      figma.ui.postMessage({
        type: "error",
        message: "Please select a section to process.",
      });
      return;
    }

    const section = selection[0] as SectionNode;

    const sectionChildren = section.children;
    console.log("Section children:", sectionChildren);

    const emailBody = sectionChildren.find(
      (child) => child.name === "Email"
    ) as FrameNode | undefined;

    const emailBodyChildren = emailBody?.children;
    if (!emailBodyChildren) {
      console.log("Email Not Found Within Section");
      return;
    }
    console.log("Email body children:", emailBodyChildren);

    const images = [];
    let artboardCounter = 1;

    // Iterate through artboards and collect their images
    for (const child of emailBodyChildren) {
      if (child.name === "Artboard") {
        const imageBytes = await (child as FrameNode).exportAsync({
          format: "PNG",
          contentsOnly: true,
          constraint: { type: "SCALE", value: 1 },
        });

        images.push({
          content: imageBytes,
          name: `Artboard_${artboardCounter}.png`,
        });

        artboardCounter++;
      }
    }

    // Send all images to the UI
    figma.ui.postMessage({
      type: "download-images",
      images, // Array of { content, name }
    });

    // Process the rest of the HTML as before
    const html = await Promise.all(
      emailBodyChildren.map(async (child) => {
        if (child.name === "Artboard") {
          return `<div id="${child.name}"><a href="#"><img src="https://cdn.prod.website-files.com/67374e418f3dea04e00ad1e9/673756cfd9a8282cf25969d9_6191a88a1c0e39463c2bf022_placeholder-image.svg" alt="Placeholder Image" /></a></div>`;
        } else if (child.name === "Body") {
          // Extract styles using getCSSAsync
          const bodyStyles = await child.getCSSAsync();
          const styleString = Object.entries(bodyStyles)
            .map(([key, value]) => `${key}: ${value};`)
            .join(" ");

          // Inline logic to process children of Body
          const childTextElements = (child as FrameNode).children
            .filter((child: SceneNode) => child.type === "TEXT") // Only process text elements
            .map(async (textNode: SceneNode) => {
              const textStyles = await (textNode as TextNode).getCSSAsync();
              const textStyleString = Object.entries(textStyles)
                .map(([key, value]) => `${key}: ${value};`)
                .join(" ");
              const textContent = (textNode as TextNode).characters;

              return `<p style="${textStyleString}">${textContent}</p>`;
            });

          const bodyContent = await Promise.all(childTextElements);

          return `<div id="${
            child.name
          }" style="${styleString}">${bodyContent.join("\n")}</div>`;
        } else {
          return `<div id="${child.name}"></div>`;
        }
      })
    );

    const finalHtml = html.join("\n");

    figma.ui.postMessage({
      type: "update-highlighted-content",
      content: finalHtml,
    });

    console.log("Generated HTML:", finalHtml);
  } else if (msg.type === "cancel") {
    figma.closePlugin();
  }
};
