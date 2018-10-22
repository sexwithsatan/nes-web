/* globals window, Worker */
import animate from '@esnes/animated-canvas'
import serialize from './serialize.js'
import captureEvent from './capture-event.js'
import {PLAY, PAUSE} from './pause.js'
import bindAttribute from './bind-attribute.js'
import uploadAsArrayBuffer from './upload-as-array-buffer.js'

function* frames(ww) {
  while (true) {

    // Keep the worker synchronized with the animation loop
    ww.postMessage({ms: yield})
  }
}

async function main({document: d}) {
  const ww = new Worker('js/worker.js')
  const {target: form} = await captureEvent('submit', d)
  const rom = await uploadAsArrayBuffer(form.rom.files[0])
  const {fps} = serialize(form.options.elements)
  const canvas = d.getElementById('canvas')
  const context = canvas.getContext('bitmaprenderer')
  const paused = bindAttribute(canvas, 'data-paused', [PLAY, PAUSE])
  const fsm = animate(function* (start, stop) {

    // The animation loop is driven by a 2-state FSM:
    //  (1) Rendering begins with the PAUSE -> PLAY transition
    //  (2) Rendering is suspended by the PLAY -> PAUSE transition
    //  (1) Rendering resumes on the next PAUSE -> PLAY transition
    // ...and so forth.
    while (true) {
      const animation = start(fps, () => frames(ww))
      yield PLAY

      stop(animation)
      yield PAUSE
    }
  })

  // Put the FSM into its initial state
  fsm.next()

  // Send the <canvas> dimensions and the ROM file to the worker
  ww.postMessage(serialize(canvas.attributes, {rom}), [rom])

  canvas.addEventListener('click', function () {
    const {value} = fsm.next()

    // Update the [paused] attribute on each transition
    paused.set(value)
  })

  ww.addEventListener('message', function ({data: bitmap}) {

    // When the worker has finished rendering a frame, display it
    requestAnimationFrame(() => context.transferFromImageBitmap(bitmap))
  })
}

main(window)
