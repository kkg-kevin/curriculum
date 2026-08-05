import { Node, mergeAttributes } from "@tiptap/core";

// No official TipTap video extension exists (unlike @tiptap/extension-image) — this mirrors that
// package's own shape closely enough that RichTextEditor.jsx's "insert image" pattern (upload,
// then a single chained command) works identically for video. Renders a plain <video controls>
// tag, which RichContent.jsx's dangerouslySetInnerHTML already plays with no viewer changes.
// Mirrors courses/components/VideoExtension.js — see that module for the same node in Course
// Sessions; kept as its own copy here since this module doesn't import across feature boundaries.
const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "controls" })];
  },

  addCommands() {
    return {
      setVideo: (options) => ({ commands }) => commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});

export default Video;
