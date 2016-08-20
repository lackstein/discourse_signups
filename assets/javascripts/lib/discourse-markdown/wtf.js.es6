export function setup(helper) {
  helper.replaceBlock({
    start: /(\[code\])([\s\S]*)/igm,
    stop: '[/code]',
    rawContents: true,

    emitter(blockContents) {
      return ['p', ['pre'].concat(blockContents)];
    }
  });
}
