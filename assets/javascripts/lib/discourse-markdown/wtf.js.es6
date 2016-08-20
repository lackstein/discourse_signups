export function setup(helper) {
  helper.whiteList([
    'p',
    'pre'
  ]);
  
  helper.replaceBlock({
    start: /(\[cod\])([\s\S]*)/igm,
    stop: '[/cod]',
    rawContents: true,

    emitter(blockContents) {
      return ['p', ['pre'].concat(blockContents)];
    }
  });
}
