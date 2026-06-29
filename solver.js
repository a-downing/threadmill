function normalizeCutterGeometry(cutter, pitch, threadAngle, tipGeometry) {
    const alpha = (threadAngle / 2) * Math.PI / 180;
    const P = pitch;
    const geometry = (typeof tipGeometry === 'object' && tipGeometry !== null) ? tipGeometry : { type: 'flat', tipFlat: tipGeometry };
    const type = geometry.type === 'rounded' ? 'rounded' : (geometry.type === 'sharp' ? 'sharp' : 'flat');

    function axialHalfWidthAtDepth(depth) {
        if (type === 'rounded') {
            const tipRadius = Math.max(0, geometry.tipRadius || 0);
            if (tipRadius <= 0) return depth * Math.tan(alpha);

            const tangentDepth = tipRadius * (1 - Math.sin(alpha));
            const tangentHalfWidth = tipRadius * Math.cos(alpha);
            if (depth <= tangentDepth) {
                const inside = Math.max(0, tipRadius * tipRadius - Math.pow(depth - tipRadius, 2));
                return Math.sqrt(inside);
            }
            return tangentHalfWidth + (depth - tangentDepth) * Math.tan(alpha);
        }

        if (type === 'sharp') return depth * Math.tan(alpha);
        return (geometry.tipFlat || 0) / 2 + depth * Math.tan(alpha);
    }

    function depthAtAxialHalfWidth(targetHalfWidth) {
        if (type === 'rounded') {
            const tipRadius = Math.max(0, geometry.tipRadius || 0);
            if (tipRadius <= 0) return targetHalfWidth / Math.tan(alpha);

            const tangentDepth = tipRadius * (1 - Math.sin(alpha));
            const tangentHalfWidth = tipRadius * Math.cos(alpha);
            if (targetHalfWidth <= tangentHalfWidth) {
                return tipRadius - Math.sqrt(Math.max(0, tipRadius * tipRadius - targetHalfWidth * targetHalfWidth));
            }
            return tangentDepth + (targetHalfWidth - tangentHalfWidth) / Math.tan(alpha);
        }

        if (type === 'sharp') return targetHalfWidth / Math.tan(alpha);
        return (targetHalfWidth - (geometry.tipFlat || 0) / 2) / Math.tan(alpha);
    }

    const pitchDepth = depthAtAxialHalfWidth(P / 4);
    const cutterPitchDiameter = cutter - 2 * pitchDepth;

    return {
        type: type,
        cutterPitchDiameter: cutterPitchDiameter,
        axialHalfWidthAtDepth: axialHalfWidthAtDepth,
        depthAtAxialHalfWidth: depthAtAxialHalfWidth,
        tipFlat: geometry.tipFlat || 0,
        tipRadius: geometry.tipRadius || 0
    };
}

function solveThreadMillOffset(isFemale, pd, major, minor, cutter, pitch, threadAngle, tipGeometry, iterations=10) {
    const alpha = (threadAngle / 2) * Math.PI / 180;
    const P = pitch;
    const R_pd = pd / 2;
    
    // Calculate the Cutter's Pitch Diameter
    // (The diameter on the cutter where the tooth width is exactly P/2)
    const cutterProfile = normalizeCutterGeometry(cutter, pitch, threadAngle, tipGeometry);
    const cutter_pd = cutterProfile.cutterPitchDiameter;
    
    // Initial Orbit Radius (Rc) based on Pitch Diameter Alignment
    // Fusion 360 does not offset the tool's tip to the major diameter; 
    // it perfectly aligns the tool's PD with the thread's PD.
    let Rc_initial = isFemale ? (pd - cutter_pd) / 2 : (pd + cutter_pd) / 2;
    let Rc_current = Rc_initial;
    
    for(let i=0; i<iterations; i++) {
        let r_0 = isFemale ? (R_pd - Rc_current) : (Rc_current - R_pd);
        
        let C2 = (R_pd * Rc_current) / (2 * r_0);
        let C4 = (R_pd * Rc_current) / (24 * r_0) + (Math.pow(R_pd, 2) * Math.pow(Rc_current, 2)) / (8 * Math.pow(r_0, 3));
        
        let a = 4 * C4 * Math.tan(alpha);
        let c = -2 * C2 * Math.tan(alpha);
        let d = P / (2 * Math.PI);
        
        let theta_opt = -d / c; // Initial guess
        
        // Newton-Raphson
        for(let j=0; j<3; j++) {
            let f_val = a * Math.pow(theta_opt, 3) + c * theta_opt + d;
            let f_prime = 3 * a * Math.pow(theta_opt, 2) + c;
            theta_opt = theta_opt - (f_val / f_prime);
        }
        
        let delta_Z = theta_opt * (P / (2 * Math.PI)) - C2 * Math.tan(alpha) * Math.pow(theta_opt, 2) + C4 * Math.tan(alpha) * Math.pow(theta_opt, 4);
        delta_Z = Math.abs(delta_Z);
        
        let delta_r = delta_Z / Math.tan(alpha);
        
        Rc_current = isFemale ? (Rc_initial - delta_r) : (Rc_initial + delta_r);
    }
    
    let radial_compensation = Math.abs(Rc_current - Rc_initial);
    let diametral_compensation = radial_compensation * 2;
    
    // Reconstruct Fusion PDO assuming default Major-Minor
    // For Female: PDO = 2*Rc - minor + cutter
    let fusion_auto_pdo = isFemale ? (2 * Rc_initial - minor + cutter) : (major + cutter - 2 * Rc_initial);
    let pdo = isFemale ? (2 * Rc_current - minor + cutter) : (major + cutter - 2 * Rc_current);
    
    let resulting_major = isFemale ? (2 * Rc_current + cutter) : null;
    let resulting_minor = !isFemale ? (2 * Rc_current - cutter) : null;
    
    return {
        Rc_initial: Rc_initial,
        Rc_opt: Rc_current,
        radial_compensation: radial_compensation,
        diametral_compensation: diametral_compensation,
        fusion_auto_pdo: fusion_auto_pdo,
        pdo: pdo,
        resulting_major: resulting_major,
        resulting_minor: resulting_minor,
        cutter_pitch_diameter: cutter_pd
    };
}

// Test block when run with Node
if (typeof require !== 'undefined' && require.main === module) {
    console.log("Testing Female M14x2...");
    let res = solveThreadMillOffset(true, 12.8069, 14.3138, 12.0225, 11.7, 2.0, 60.0, 0.13);
    console.log(res);
}
