import fetch from "node-fetch";
import camelcase from "camelcase";
import setWith from "lodash.setwith";

const API = `https://api.figma.com/v1`;

class FigmaFetcher {
  constructor({ figma_token, file_key }) {
    this.figma_token = figma_token;
    this.file_key = file_key;

    this.cache = {};
  }

  _pages = async () => {
    const response = await fetch(`${API}/files/${this.file_key}?depth=1`, {
      headers: {
        "X-Figma-Token": this.figma_token,
      },
    });

    return await response.json();
  };

  _file = async (ids) => {
    const queryString = ids ? `?${new URLSearchParams({ ids })}` : "";
    const url = `${API}/files/${this.file_key}` + queryString;

    console.log(`fetching ${url}`);

    const response = await fetch(url, {
      headers: {
        "X-Figma-Token": this.figma_token,
      },
    });

    return await response.json();
  };

  _fileNodes = async (ids) => {
    const queryString = ids ? `?${new URLSearchParams({ ids })}` : "";
    const url = `${API}/files/${this.file_key}/nodes` + queryString;
    console.log(`fetching ${url}`);

    const response = await fetch(url, {
      headers: {
        "X-Figma-Token": this.figma_token,
      },
    });

    return await response.json();
  };

  pages = async () => {
    if (this.cache.pages) return this.cache.pages;

    const formatName = (name) => camelcase(name).split(" ")[0];

    const json = await this._pages();

    const groups = {};
    let currentGroup;
    json.document.children.forEach(({ id, name: fullName }) => {
      const [type, name] = fullName.trim().split(" ", 2);
      if (!type || !name) return;

      if (type === "↓") {
        currentGroup = formatName(name);
        groups[currentGroup] = {};
      } else if (type === "❖") {
        groups[currentGroup][formatName(name)] = {
          id,
        };
      } else if (type === "◆") {
        groups[currentGroup][formatName(name)] = { id };
      }
    });

    this.cache.pages = groups;
    return this.cache.pages;
  };

  tokens = async () => {
    const pages = await this.pages();
    const tokensNodeId = pages.foundations.tokens.id;

    const json = await this._file(tokensNodeId);

    const nodes = {};
    const appendChildrenToNodeMap = (node) => {
      (node.children ?? []).forEach((child) => {
        nodes[child.id] = child;
        appendChildrenToNodeMap(child);
      });
    };

    appendChildrenToNodeMap(json.document);

    console.time();
    const styleNodes = [];
    const numStyles = Object.entries(json.styles).length;
    for (let i = 0; i < numStyles; i += 20) {
      console.log(`fetching styles ${i} - ${i + 20} out of ${numStyles}`);
      const promises = Object.entries(json.styles)
        .slice(i, i + 20) // TODO: RATE LIMITING HACK
        .map(([styleNodeId, styleInfo]) => {
          return this._fileNodes(styleNodeId).then((styleNode) => ({
            ...styleInfo,
            ...styleNode.nodes[styleNodeId].document,
          }));
        });

      const resolvedStyles = await Promise.all(promises);
      styleNodes.push(...resolvedStyles);
    }

    console.log(styleNodes);

    const rgbify = (c) => ({
      r: parseInt(c.r * 255),
      g: parseInt(c.g * 255),
      b: parseInt(c.b * 255),
      a: parseFloat(c.a.toFixed(2)),
    });

    const colors = {};
    const text = {};
    const elevation = {};
    styleNodes.forEach((node) => {
      const path = node.name.replaceAll("/", ".");

      switch (node.styleType) {
        case "FILL":
          setWith(colors, path, rgbify(node.fills[0].color), Object);
          break;
        case "TEXT": {
          const {
            fontFamily,
            fontWeight,
            fontSize,
            lineHeightPx,
            letterSpacing,
          } = node.style;

          setWith(
            text,
            path,
            {
              fontFamily,
              fontWeight,
              fontSize,
              lineHeight: lineHeightPx,
              letterSpacing:
                letterSpacing === 0 ? "normal" : letterSpacing.toFixed(2),
            },
            Object
          );
          break;
        }
        case "EFFECT": {
          setWith(
            elevation,
            path,
            node.effects.map((effect) => ({
              x: effect.offset.x,
              y: effect.offset.y,
              radius: effect.radius,
              spread: effect.spread,
              color: rgbify(effect.color),
            })),
            Object
          );
          break;
        }
        default:
          return;
      }
    });

    console.log(JSON.stringify(colors, null, "\t"));
    console.log(JSON.stringify(text, null, "\t"));
    console.log(JSON.stringify(elevation, null, "\t"));
    console.timeEnd();
    return tokensNodeId;
  };
}

export default FigmaFetcher;
