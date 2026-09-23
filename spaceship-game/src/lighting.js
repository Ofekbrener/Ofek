import * as THREE from 'three';

// Scene lights: sky/ground fill, a key light, and a pooled flash light for impacts.
export class Lighting {
  constructor(scene) {
    this.hemi = new THREE.HemisphereLight(0x8fb8ff, 0x3a1450, 1.4);
    scene.add(this.hemi);

    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(4, 8, 6);
    scene.add(this.key);

    this.rim = new THREE.DirectionalLight(0xff3ca8, 1.2);
    this.rim.position.set(-6, 2, -10);
    scene.add(this.rim);

    this.flash = new THREE.PointLight(0xffaa55, 0, 30, 1.6);
    scene.add(this.flash);
    this.flashPower = 0;

    this._targetSky = new THREE.Color(0x8fb8ff);
    this._targetRim = new THREE.Color(0xff3ca8);
  }

  flashAt(x, y, z, power = 120, color = 0xffaa55) {
    this.flash.position.set(x, y, z);
    this.flash.color.set(color);
    this.flashPower = power;
  }

  // Tint the sky fill + rim light to a galaxy's palette (tweened in update).
  setTheme(g) {
    this._targetSky.set(g.colors.sky);
    this._targetRim.set(g.colors.rim);
  }

  update(realDt) {
    this.flashPower *= Math.exp(-realDt * 6);
    this.flash.intensity = this.flashPower;
    const k = 1 - Math.exp(-realDt * 1.5);
    this.hemi.color.lerp(this._targetSky, k);
    this.rim.color.lerp(this._targetRim, k);
  }
}
