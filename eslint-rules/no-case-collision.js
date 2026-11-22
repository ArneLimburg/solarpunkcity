import { readdirSync } from "node:fs";
import { basename, dirname, extname } from "node:path";

const stem = (file) => basename(file, extname(file));

/** Reports files whose name (without extension) differs from a sibling only in casing. */
const rule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      collision:
        '"{{file}}" and "{{other}}" differ only in casing; this breaks case-insensitive file systems.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename;
        const name = basename(filename);
        const own = stem(name);
        const other = readdirSync(dirname(filename)).find(
          (entry) =>
            stem(entry) !== own &&
            stem(entry).toLowerCase() === own.toLowerCase(),
        );
        if (other) {
          context.report({
            node,
            messageId: "collision",
            data: { file: name, other },
          });
        }
      },
    };
  },
};

export default { rules: { "no-case-collision": rule } };
