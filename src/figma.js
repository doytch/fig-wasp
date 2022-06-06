import fetch from "node-fetch";
import camelcase from "camelcase";

const API = `https://api.figma.com/v1`;

class FigmaFetcher {
  constructor({ figma_token, file_key }) {
    this.figma_token = figma_token;
    this.file_key = file_key;
  }

  _pages = async () => {
    const response = await fetch(`${API}/files/${this.file_key}?depth=1`, {
      headers: {
        "X-Figma-Token": this.figma_token,
      },
    });

    return await response.json();
  };

  pages = async () => {
    const formatName = (name) => camelcase(name).split(" ")[0];

    const json = await this._pages();

    const groups = {};
    let currentGroup;
    json.document.children.forEach(({ id, name: fullName }) => {
      const [type, name] = fullName.trim().split(" ", 2);
      if (!type || !name) return;

      console.log({ type, name });

      if (type === "↓") {
        currentGroup = formatName(name);
        groups[currentGroup] = [];
      } else if (type === "❖") {
        groups[currentGroup][formatName(name)] = {
          id,
        };
      } else if (type === "◆") {
        groups[currentGroup][formatName(name)] = { id };
      }
    });

    return groups;
  };
}

export default FigmaFetcher;
