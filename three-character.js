/* three-character.js
   Simple Three.js overlay that draws a low-poly character (sphere + cone hat)
   and syncs its screen position with the Phaser player rectangle in the other canvas.
   Uses global `game` from phaser-game.js to read player.x / player.y
*/

(function () {
  // basic scene setup
  const canvas = document.getElementById('three-canvas')
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 0, 10)

  // light
  const ambient = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambient)
  const dir = new THREE.DirectionalLight(0xffffff, 0.5)
  dir.position.set(5, 10, 7)
  scene.add(dir)

  // character group: sphere body + small cone hat (low-poly look)
  const group = new THREE.Group()
  const bodyGeo = new THREE.SphereGeometry(0.9, 12, 8)
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4cc9f0, roughness: 0.6, metalness: 0.1 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  group.add(body)

  const coneGeo = new THREE.ConeGeometry(0.5, 0.9, 8)
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xffdd77, roughness: 0.5 })
  const hat = new THREE.Mesh(coneGeo, coneMat)
  hat.position.set(0, 1.1, 0)
  hat.rotation.x = Math.PI / 6
  group.add(hat)

  // small bobbing shadow
  const shadowGeo = new THREE.CircleGeometry(1.0, 12)
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.12, transparent: true })
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.2
  group.add(shadow)

  scene.add(group)

  // convert Phaser world position to Three.js world coords:
  // Phaser origin (0,0) top-left; camera center maps to (0,0) in three coords
  function phaserToThree(px, py) {
    const wx = (px - window.innerWidth / 2) / 50 // scale factor (tweak)
    const wy = -(py - window.innerHeight / 2) / 50
    return { x: wx, y: wy }
  }

  // animation loop
  function animate() {
    requestAnimationFrame(animate)
    // rotate hat/body mildly for life
    group.rotation.y += 0.008

    // if Phaser game exists and has player, sync position
    if (window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes[0]) {
      const scene0 = window.game.scene.scenes[0]
      const p = scene0 && scene0.sys && scene0.sys.displayList && scene0.sys.displayList.list ? null : null
      // we access the global "player" variable from phaser-game.js (created in global scope)
      if (typeof window.player !== 'undefined' && window.player) {
        const pos = phaserToThree(window.player.x, window.player.y)
        group.position.x = pos.x
        group.position.y = pos.y - 0.2
        // scale slightly based on Y (simulate perspective)
        const scale = 1 + (pos.y * 0.03)
        group.scale.setScalar(1 + Math.max(-0.2, Math.min(0.3, -pos.y * 0.03)))
      }
    }

    renderer.render(scene, camera)
  }
  animate()

  // handle resize
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  })
})()
