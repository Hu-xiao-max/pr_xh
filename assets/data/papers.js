/* =============================================================================
   papers.js — the single source of truth for the page.

   • Order of the array = order of the slides (one slide per paper).
   • `topics` feed the cover statistics; `tags` are shown as keyword chips.
   • `media.main`  = long overview / narrated video → native controls, no autoplay.
     `media.clips` = short demo loops → muted autoplay while the slide is on screen.
     `w`/`h` are the encoded pixel size (keeps the layout stable before loading),
     `duration` in seconds, `audio: true` adds an unmute button to a loop.
   • `caption` may contain HTML; everything else is plain text.
   • Lines marked TODO are placeholders to confirm/fill in (also listed in README).
   ============================================================================= */

window.SITE = {
  pageTitle: 'Research Highlights',

  // Cover slide copy. Plain text; `accent` is the grey second half of the headline.
  hero: {
    eyebrow: 'Research highlights \u00b7 Robot skill learning',
    title: 'Robots need skills.',
    accent: 'This work helps them learn.',
    intro: 'A robot is only as capable as the skills it can acquire \u2014 grasping an unfamiliar object, spinning a pen, unfolding a shirt, or picking up a trick a person just showed it. Every project here asks the same question: how can a robot learn such skills faster, more robustly and from fewer trials?',
  },

  // Closing slide.
  closing: {
    eyebrow: 'In short',
    title: 'Three threads run through this work',
    points: [
      { lead: 'Sense the contact, not just the picture.', text: 'Tactile feedback, fingertip closure events and fold\u2013contact affordances expose what a camera alone cannot see.' },
      { lead: 'Make real-world learning affordable.', text: 'Calibration-free keypoint rewards, physics-filtered grasp labels and smarter training resets cut the cost of data and trials.' },
      { lead: 'Bridge people and robots.', text: 'Compositional skill prototypes and intuitive teleoperation move human skill onto robot hardware.' },
    ],
    thanks: 'Thank you \u2014 questions?',
  },

  // Author lists are kept in the data (BibTeX needs them) but are not shown anywhere:
  // not on the slides, not in the abstract dialog. Set to true to show them again.
  showAuthors: false,

  // Topic labels used for the cover statistics ("Real Robot" counts real-robot studies).
  topics: [
    'Grasping',
    'Dexterous Manipulation',
    'Reinforcement Learning',
    'Imitation & Skill Transfer',
    'Deformable Objects',
    'Teleoperation',
    'Real Robot',
  ],
};

window.PAPERS = [

  /* ------------------------------------------------------------------ */
  {
    id: 'uniprototype',
    shortTitle: 'UniPrototype',
    title: 'UniPrototype: Human-Robot Skill Learning with Uniform Prototypes',
    venue: 'IROS 2026',
    venueFull: '2026 IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS), Pittsburgh, PA, USA, Sept 27 – Oct 1, 2026',
    year: 2026,
    status: { key: 'accepted', label: 'Accepted' },
    authors: [
      { name: 'Xiao Hu', affil: [1] },
      { name: 'Yip Fun Yeung', affil: [2] },
      { name: 'Yuhai Wang', affil: [1] },
      { name: 'Tianyu Zhou', affil: [3] },
      { name: 'Fang Xu', affil: [3] },
      { name: 'Jing Du', affil: [3] },
      { name: 'Gilbert Ye', affil: [1], corresponding: true },
    ],
    affiliations: ['Northeastern University', 'Massachusetts Institute of Technology', 'University of Florida'],
    affiliationsNote: '* corresponding author',
    topics: ['Imitation & Skill Transfer', 'Real Robot'],
    tags: ['Cross-embodiment transfer', 'Skill prototypes', 'Diffusion policy', 'Franka Research 3'],
    tldr: 'Robots cannot learn from the Internet’s ocean of human videos because human and robot bodies differ. UniPrototype learns a shared vocabulary of soft, co-activating skill prototypes whose size adapts to task complexity, so skills demonstrated by a person transfer to a robot — and recombine into tasks the robot has never seen.',
    highlights: [
      { value: '91.3%', label: 'same-embodiment success (sim), vs. 84.6% XSkill' },
      { value: '87.5%', label: 'cross-embodiment success (sim), vs. 78.2% XSkill' },
      { value: '5 tasks', label: 'real-world human-to-robot transfer on a Franka Research 3' },
    ],
    abstract: 'Data scarcity remains a fundamental bottleneck for robotic manipulation: robots cannot readily leverage the vast amount of human skill data available on the Internet. Bridging this embodiment gap requires transferable skill representations that can be reliably matched across human and robot domains. We propose UniPrototype, a framework that transfers skills by discovering and aligning latent skill representations through prototype assignment across diverse tasks. UniPrototype learns a compositional representation in which multiple prototypes can co-activate, capturing continuous mixtures of reusable skill factors and improving transferability. To further scale with task diversity, we introduce an adaptive prototype selection strategy that automatically adjusts the number of active prototypes based on task complexity, yielding an efficient representation without sacrificing expressiveness. We validate UniPrototype through extensive experiments in simulation and on real-world robotic systems, where it consistently improves task performance and enables effective human-to-robot skill transfer compared to prior approaches.',
    links: {
      pdf: 'iros26/IROS26_1535_FI.pdf',
      arxiv: '',    // TODO
      code: '',     // TODO
    },
    bibtex: `@inproceedings{hu2026uniprototype,
  title     = {UniPrototype: Human-Robot Skill Learning with Uniform Prototypes},
  author    = {Hu, Xiao and Yeung, Yip Fun and Wang, Yuhai and Zhou, Tianyu and Xu, Fang and Du, Jing and Ye, Gilbert},
  booktitle = {2026 IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS)},
  address   = {Pittsburgh, PA, USA},
  year      = {2026}
}`,
    media: {
      main: {
        kind: 'overview',
        label: 'Supplementary video',
        src: 'assets/videos_web/uniprototype-v3subiros.mp4',
        poster: 'assets/posters/uniprototype-v3subiros.jpg',
        w: 1280, h: 680, duration: 60,
        caption: '<b>Supplementary video (1:00).</b> Motivation, the UniPrototype pipeline, human→robot transfer on seen tasks (wipe desk, pick banana), compositional recombination on the unseen “wipe banana” task, and real-robot rollouts (×1.5).',
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'pixelpoint-rl',
    shortTitle: 'Seeing Points, Doing It',
    navTitle: 'Pixel-Point RL',
    title: 'Seeing Points, Doing It: Pixel-Point State for Calibration-Free Real-World Reinforcement Learning',
    venue: 'ICRA 2027',
    venueFull: 'Submitted to the 2027 IEEE International Conference on Robotics and Automation (ICRA) — under double-blind review',
    year: 2027,
    status: { key: 'review', label: 'Under review' },
    authors: [],   // TODO: add the author list once the review period allows it
    authorsNote: 'Author list withheld during double-blind review',
    topics: ['Reinforcement Learning', 'Deformable Objects', 'Real Robot'],
    tags: ['Real-world RL', 'Point tracking', 'Calibration-free', 'Soft Actor-Critic', 'Franka Research 3'],
    tldr: 'Point two uncalibrated cameras at the scene, mark the goal in the image, and let the robot learn: tracked 2D keypoints serve as both the policy state and the reward, so real-world RL needs no camera calibration, no 3D reconstruction and no pose estimation. A Bayesian contact belief gates a dual-head policy, reaching 84.4% success on seven contact-rich tasks.',
    highlights: [
      { value: '84.4%', label: 'success over 7 real-world tasks (rigid, articulated, deformable)' },
      { value: '92.9%', label: 'tracking recovery after 30 s of full occlusion' },
      { value: 'κ = 0.88', label: 'relational reward agrees with physical success' },
    ],
    abstract: 'Real-world reinforcement learning (RL) can learn contact-rich manipulation directly from interaction, but deployment requires perception and rewards without task-specific engineering. We present a calibration-free framework that uses online RGB point tracking as a unified pixel-space interface. Tracked keypoints from uncalibrated views define the policy state and a final-state relational reward. Relations are computed within each view without cross-view association, so neither robot–camera extrinsics nor 3D reconstruction is required. A belief-gated dual-head Soft Actor-Critic policy combines a temporal prior with reward-change evidence through a two-state Bayesian filter. On seven real-world tasks spanning rigid, articulated, and deformable objects, the approach achieves 84.4% success averaged over tasks and 3 random seeds, outperforming behavior cloning trained on 50 demonstrations per task, vision-based RL, and single-head SAC. Tracking recovers at 92.9% after 30 s of full-view occlusion with hidden object displacement, and injected keypoint jitter and drift degrade success gradually. The relational success criterion agrees with physical success on 94.3% of evaluation episodes (Cohen’s κ = 0.88). In a targeted simulation ablation over 10 seeds, Bayesian belief gating reaches 60.8% success, versus 41.1% for a capacity-matched single head, 47.2% for an EMA gate, and 44.5% for a learned gate, and is the only variant with no collapsed seed. Against ground-truth contact the gate reaches F1 0.87, where fixed, smooth, EMA, learned, and instantaneous gates reach 0.61–0.75, and control success tracks that accuracy: Bayesian temporal inference is an essential component that works by inferring contact, not by adding capacity or smoothing. A separate contact-regime study identifies a sustained stick-slip setting where gating underperforms single-head SAC. Camera-displacement studies support calibration-free deployment up to 20 cm; the relational reward is scoped to static geometric goals.',
    links: {
      pdf: 'pixel_RL/ICRA27_5965_MS.pdf',
      arxiv: '',    // TODO
      code: '',     // TODO
    },
    bibtex: `@misc{anonymous2027seeingpoints,
  title  = {Seeing Points, Doing It: Pixel-Point State for Calibration-Free Real-World Reinforcement Learning},
  author = {Anonymous},
  year   = {2026},
  note   = {Under review at the 2027 IEEE International Conference on Robotics and Automation (ICRA)}
}`,
    media: {
      main: {
        kind: 'overview',
        label: 'Overview video',
        src: 'assets/videos_web/pixelpoint-rl-icra27.mp4',
        poster: 'assets/posters/pixelpoint-rl-icra27.jpg',
        w: 810, h: 480, duration: 166,
        caption: '<b>Overview video (2:46).</b> Why real-world RL, how keypoints tracked in uncalibrated RGB views define both the state and the reward, and time-lapse (×10) training on rigid, articulated and deformable tasks with a Franka Research 3.',
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'object-spin',
    shortTitle: 'Where to Start a Dynamic Skill',
    navTitle: 'Object Spinning',
    title: 'Where to Start a Dynamic Skill: Learning Object Spinning from Contact Transitions',
    venue: 'ICRA 2027',
    venueFull: 'Submitted to the 2027 IEEE International Conference on Robotics and Automation (ICRA) — under double-blind review',
    year: 2027,
    status: { key: 'review', label: 'Under review' },
    authors: [],   // TODO: add the author list once the review period allows it
    authorsNote: 'Author list withheld during double-blind review',
    topics: ['Dexterous Manipulation', 'Reinforcement Learning', 'Real Robot'],
    tags: ['In-hand manipulation', 'Pen spinning', 'Wrench-space analysis', 'Reset distributions', '22-DoF hand'],
    tldr: 'Where a dynamic skill starts matters more than how stable the grasp is. Harvesting the moments when opposing fingertip contacts form during rotation, and using those “catches” as training resets, lifts pen-spinning sustain from 18% to 78% at equal budget — and the same closure certificate shapes rewards without any online wrench-hull construction.',
    highlights: [
      { value: '18% → 78%', label: 'mean simulated sustain with closure-event resets' },
      { value: '8 objects', label: 'deployed on a 22-DoF Sharpa Wave hand' },
      { value: '29%', label: 'of steps have fingertip force closure — closure is intermittent' },
    ],
    abstract: 'Learning dynamic in-hand skills requires initial grasps that allow motion to develop. Wrench-space analysis of pen spinning shows that closure is intermittent and initial static margins poorly predict sustained motion. We propose closure-event grasp discovery, which selects training starts when opposing fingertip contacts form during rotation. An angle-space certificate detects these transitions; persistence and future-survival checks retain configurations for zero-velocity resets of a fresh policy. The same certificate provides lightweight, rotation-gated reward shaping without online wrench-hull construction. On the original grasp cache, event-trained pen policies increase mean simulation sustain from 18% to 78% at equal second-stage training budget. Comparisons with matched non-event states and alternative initialization strategies support the value of contact-transition selection. The benefit persists without second-stage shaping, and useful resets can be recovered even from a poorly performing source. Object-specific training on ten simulated objects and deployment on eight physical objects further evaluate the shaping pipeline. These results identify contact timing as a useful principle for choosing where to begin learning dynamic manipulation.',
    links: {
      pdf: 'wrench_spin/ICRA27_6150_MS.pdf',
      arxiv: '',    // TODO
      code: '',     // TODO (paper: "analysis tools, caches and logs will be released")
    },
    bibtex: `@misc{anonymous2027wheretostart,
  title  = {Where to Start a Dynamic Skill: Learning Object Spinning from Contact Transitions},
  author = {Anonymous},
  year   = {2026},
  note   = {Under review at the 2027 IEEE International Conference on Robotics and Automation (ICRA)}
}`,
    media: {
      main: {
        kind: 'overview',
        label: 'Overview video',
        src: 'assets/videos_web/object-spin-icra27-6150-vi-i.mp4',
        poster: 'assets/posters/object-spin-icra27-6150-vi-i.jpg',
        w: 1280, h: 720, duration: 172,
        caption: '<b>Overview video (2:52).</b> Closure-event grasp discovery step by step — recognise an opposing fingertip pair, keep the configuration, restart learning — the simulation evidence (18% → 78% sustain, matched-state controls) and the 22-DoF hand spinning eight physical objects.',
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'cloth-unfold',
    shortTitle: 'From Contact to Action',
    navTitle: 'Cloth Unfolding',
    title: 'From Contact to Action: Fold-Contact Affordances for Cloth Unfolding',
    venue: 'ICLR 2027',
    venueFull: 'Under review as a conference paper at ICLR 2027 (double-blind)',
    year: 2027,
    status: { key: 'review', label: 'Under review' },
    authors: [],   // TODO: add the author list once the review period allows it
    authorsNote: 'Author list withheld during double-blind review',
    topics: ['Deformable Objects', 'Reinforcement Learning', 'Real Robot'],
    tags: ['Cloth manipulation', 'Dual-arm', 'Transparent table', 'Affordances', 'Contextual bandit'],
    tldr: 'The overhead silhouette lies; the table underneath tells the truth. Looking up through a transparent table exposes where a garment is actually supported, and turning those fold–contact cues into affordance maps and grasp priors cuts the folded area by 82% relative to raw dual-view pixels.',
    highlights: [
      { value: '−82.2%', label: 'folded area vs. raw dual masks (fast screen)' },
      { value: '0.840', label: 'within-panel geometry score, best of 21 residual-prior variants' },
      { value: '2 views', label: 'top segmentation mask + bottom contact mask' },
    ],
    abstract: 'Manipulation depends on physical relationships that visible shape alone can leave ambiguous. Cloth unfolding makes this problem concrete: the same overhead silhouette can conceal different arrangements of folds and support. We study how complementary sensing can expose support cues and make them useful for action. A transparent-table dual-arm setup pairs a top segmentation mask with a bottom contact mask. We derive fold residual, contact overlap, fold-contact frontier, and silhouette-edge maps for an attention encoder and a residual action prior. An online linear, contextual-bandit-style scorer adapts the prior’s target ranking from reward, self-supervised unfolding progress, or their mixture. In the long-horizon comparison, raw dual-view pixels improve flatness over a top-only policy; affordance channels reduce folded area by 82.2% relative to raw dual masks in a fast screen; and the reward-bandit bottom-view scorer performs best in the 21-run residual-prior ablation, with within-panel geometry score 0.840 ± 0.047. Additional randomized-state and physical evaluations extend these comparisons; calibration and illumination studies characterize the sensing requirements. These findings suggest a design principle for cloth unfolding: organize perception around support relationships and connect that representation to target selection through interaction feedback.',
    links: {
      pdf: 'unfold/iclr.pdf',
      arxiv: '',    // TODO
      code: '',     // TODO
    },
    bibtex: `@misc{anonymous2027contacttoaction,
  title  = {From Contact to Action: Fold-Contact Affordances for Cloth Unfolding},
  author = {Anonymous},
  year   = {2026},
  note   = {Under review as a conference paper at ICLR 2027}
}`,
    media: {
      main: {
        kind: 'overview',
        label: 'Overview video',
        src: 'assets/videos_web/cloth-unfold-corlv7.mp4',
        poster: 'assets/posters/cloth-unfold-corlv7.jpg',
        w: 640, h: 480, duration: 177,
        caption: '<b>Overview video (2:57).</b> Why the overhead silhouette is misleading, what the bottom view through the transparent table reveals, and dual-arm unfolding rollouts on shirts and cloths (×20).',
      },
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'physgrasp',
    shortTitle: 'Physics-Grounded Grasp Synthesis',
    navTitle: 'Physics Grasp',
    title: 'Physics-Grounded Rapid Grasp Pose Synthesis for Novel Objects',
    venue: 'Advanced Robotics Research',
    venueFull: 'Advanced Robotics Research (Wiley) — manuscript, 2026',   // TODO: confirm journal + status
    year: 2026,
    status: { key: 'review', label: 'Under review' },   // TODO: confirm
    authors: [
      { name: 'Xiao Hu', affil: [1] },
      { name: 'Gilbert Ye', affil: [1], corresponding: true },
    ],
    affiliations: ['College of Engineering, Northeastern University, Boston, MA'],
    affiliationsNote: '* corresponding author',
    topics: ['Grasping', 'Real Robot'],
    tags: ['Grasp synthesis', 'NeRF reconstruction', 'Force closure', 'Physics filtering', 'Isaac Gym', 'Franka Hand'],
    tldr: 'Foundation grasp models stumble on out-of-distribution objects and unusual grippers. Reconstruct the object with NeRF, synthesise grasps by force-closure analysis, and let a GPU physics filter discard the ones that slip: labels come 6× faster, and real-robot success climbs from 29.6% to 73.3% after fine-tuning.',
    highlights: [
      { value: '62% → 91%', label: 'top-1 grasp success in simulation (2,500 trials / method)' },
      { value: '29.6% → 73.3%', label: 'real-robot success on nine objects (135 trials / method)' },
      { value: '2.2 h vs 13 h', label: 'to generate 6,500 grasp labels' },
    ],
    abstract: 'Robotic grasping models trained on large-scale datasets have achieved remarkable performance on common objects but often fail when encountering out-of-distribution (OOD) objects or non-standard grippers due to dataset bias and poor physical grounding. To address this, an efficient framework is proposed for fine-tuning grasping models on novel objects. High-quality 3D object meshes are reconstructed using Neural Radiance Fields (NeRF), grasp labels are generated rapidly via force-closure analysis, and a physics-based dynamic filtering process is introduced to discard unstable grasps. In a randomized simulation benchmark of 25 objects, including six held-out objects, fine-tuning with the proposed labels raises the top-1 grasp success rate from 62% to 91% (2,500 trials per method). In real-robot experiments on nine objects (135 trials per method), the success rate increases from 29.6% to 73.3%. Generating 6,500 grasp labels takes about 2.2 h, compared with about 13 h for an antipodal sampling pipeline. The framework provides a scalable grasp label generation pipeline and a physics-grounded filtering mechanism that enhances real-world grasping robustness.',
    links: {
      pdf: 'Advance_wiley/Advanced_Robotics_Research.pdf',
      arxiv: '',    // TODO
      code: '',     // TODO
    },
    bibtex: `@article{hu2026physicsgrounded,
  title   = {Physics-Grounded Rapid Grasp Pose Synthesis for Novel Objects},
  author  = {Hu, Xiao and Ye, Gilbert},
  journal = {Advanced Robotics Research},
  year    = {2026},
  note    = {Under review}
}`,
    media: {
      title: 'Real-robot demos',
      clips: [
        {
          kind: 'loop',
          label: 'Real robot',
          src: 'assets/videos_web/physgrasp-v4.mp4',
          poster: 'assets/posters/physgrasp-v4.jpg',
          w: 480, h: 360, duration: 58,
          caption: '<b>Grasping novel objects.</b> The RGB-D view with the predicted grasp (on screen) and the arm picking out-of-distribution objects — a game controller, plush toys — from a cluttered box.',   // TODO: confirm
        },
        {
          kind: 'loop',
          label: 'Comparison',
          audio: true,
          src: 'assets/videos_web/physgrasp-v6.mp4',
          poster: 'assets/posters/physgrasp-v6.jpg',
          w: 720, h: 480, duration: 24,
          caption: '<b>Side-by-side on a cylindrical object</b> (left vs. right: before vs. after fine-tuning), followed by a grasp with an arm on a mobile base.',   // TODO: confirm which side is which
        },
      ],
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'tactile-grasp',
    shortTitle: 'Tactile RL for Adaptive Grasping',
    navTitle: 'Tactile Grasping',
    title: 'Tactile-based Reinforcement Learning for Adaptive Grasping under Observation Uncertainties',
    venue: 'ICRA 2025 Workshop',   // TODO: confirm workshop name
    venueFull: 'Workshop paper, 2025 IEEE International Conference on Robotics and Automation (ICRA), Atlanta, GA, USA',
    year: 2025,
    status: { key: 'workshop', label: 'Workshop paper' },
    authors: [
      { name: 'Xiao Hu', affil: [1] },
      { name: 'Yang Ye', affil: [1] },
    ],
    affiliations: ['Northeastern University, Boston, MA'],
    topics: ['Grasping', 'Reinforcement Learning'],
    tags: ['Tactile sensing', 'PPO', 'MuJoCo', 'Construction robotics', 'Sim-to-real'],
    tldr: 'When the camera cannot be trusted, let the fingers decide. A MuJoCo tactile simulator plus PPO yields a policy that re-adjusts its grasp posture from touch alone, so grasps stay stable even when the object-pose estimate is wrong — the situation construction robots face behind occlusions.',
    highlights: [
      { value: 'PPO', label: 'policy trained on simulated tactile feedback' },
      { value: 'Down-sampled', label: 'tactile observations bridge sim and real sensors' },
    ],
    abstract: 'Robotic manipulation in industrial scenarios such as construction commonly faces uncertain observations in which the state of the manipulating object may not be accurately captured due to occlusions and partial observables. For example, object status estimation during pipe assembly, rebar installation, and electrical installation can be impacted by observation errors. Traditional vision-based grasping methods often struggle to ensure robust stability and adaptability. To address this challenge, this paper proposes a tactile simulator that enables a tactile-based adaptive grasping method to enhance grasping robustness. This approach leverages tactile feedback combined with the Proximal Policy Optimization (PPO) reinforcement learning algorithm to dynamically adjust the grasping posture, allowing adaptation to varying grasping conditions under inaccurate object state estimations. Simulation results demonstrate that the proposed method effectively adapts grasping postures, thereby improving the success rate and stability of grasping tasks.',
    links: {
      pdf: 'icra25/ICRA25.pdf',
      arxiv: '',    // TODO
      code: '',     // TODO
    },
    bibtex: `@inproceedings{hu2025tactile,
  title     = {Tactile-based Reinforcement Learning for Adaptive Grasping under Observation Uncertainties},
  author    = {Hu, Xiao and Ye, Yang},
  booktitle = {IEEE International Conference on Robotics and Automation (ICRA) Workshops},
  year      = {2025}
}`,
    media: {
      title: 'Demos',
      clips: [
        {
          kind: 'loop',
          label: 'Sim vs. real',
          audio: true,
          src: 'assets/videos_web/tactile-grasp-v5.mp4',
          poster: 'assets/posters/tactile-grasp-v5.jpg',
          w: 1260, h: 720, duration: 19,
          caption: '<b>Simulation vs. real.</b> Left: the MuJoCo tactile simulation of the gripper closing on a thin stirrer. Right: the real gripper lifting the stirrer out of a steel cup.',
        },
        {
          kind: 'loop',
          label: 'ABB YuMi',
          audio: true,
          src: 'assets/videos_web/tactile-grasp-abb-manipulation.mp4',
          poster: 'assets/posters/tactile-grasp-abb-manipulation.jpg',
          w: 720, h: 480, duration: 29,
          caption: '<b>Dual-arm demo on an ABB YuMi.</b> Grasping a thin rod and placing it into a frame.',   // TODO: confirm task description
        },
      ],
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'teleop',
    shortTitle: 'Semi-Humanoid Teleoperation',
    navTitle: 'Teleoperation',
    title: 'Teleoperation of Semi-Humanoid for Construction with Underactuated Dexterous Hand',
    venue: 'Talk · 2025',   // TODO: conference / venue name
    venueFull: 'Presentation slides, 2025',   // TODO
    year: 2025,
    status: { key: 'talk', label: 'Presentation' },
    authors: [
      { name: 'Xiao Hu', affil: [1] },
      { name: 'Yangming Shi', affil: [2] },
      { name: 'Yang Ye', affil: [1], corresponding: true },
    ],
    affiliations: ['Department of Civil and Environmental Engineering, Northeastern University', 'Department of Civil and Environmental Engineering, Colorado School of Mines'],
    affiliationsNote: '* corresponding author',
    topics: ['Teleoperation', 'Dexterous Manipulation', 'Real Robot'],
    tags: ['Apple Vision Pro', 'Hand retargeting', 'WebRTC', 'Mobile manipulator', 'Construction robotics'],
    tldr: 'Driving a semi-humanoid with an underactuated hand from noisy Apple Vision Pro hand tracking: a palm-centroid reference built from three tracked key points and a thumb-angle mapping turn unstable, asymmetric human motion into stable commands for the hand’s six degrees of freedom.',
    highlights: [
      { value: '6 DoF', label: 'hand mapping: five bending motions + thumb rotation' },
      { value: 'WebRTC', label: 'low-latency head-camera stream to the headset' },
    ],
    abstractLabel: 'Summary (compiled from the slides)',
    abstract: 'Semi-humanoid robots hold promise for unstructured and semi-structured engineering environments such as construction, both for operator safety (e.g., asbestos removal) and for collecting data toward automation. Teleoperating them for tasks that need fine manipulation and precise coordination remains difficult: tracked human motion is noisy and unstable, and the robot’s limited degrees of freedom complicate mapping human motion onto it. This work presents a teleoperation system that filters, adapts and maps noisy, asymmetric data from a human operator to a mobile manipulator with an underactuated dexterous hand. The robot’s head camera is streamed to an Apple Vision Pro over WebRTC; the headset’s hand-tracking models recognise gestures and track hand poses. The centroid of a triangle formed by three tracked palm key points serves as the palm reference for computing control parameters, and the human hand is mapped to the robot hand’s six degrees of freedom (five bending motions and one rotation), with thumb rotation derived from the angle between the thumb pad and the palm. Experiments map different hand gestures to operational commands.',
    links: {
      pdf: 'tele/prmain.pdf',
      pdfLabel: 'Slides PDF',
      arxiv: '',
      code: '',
    },
    bibtex: `@misc{hu2025teleoperation,
  title        = {Teleoperation of Semi-Humanoid for Construction with Underactuated Dexterous Hand},
  author       = {Hu, Xiao and Shi, Yangming and Ye, Yang},
  year         = {2025},
  howpublished = {Presentation}
}`,
    media: {
      title: 'Demo clips',
      clips: [
        {
          kind: 'loop',
          label: 'Arm teleop',
          src: 'assets/videos_web/teleop-tele1.mp4',
          poster: 'assets/posters/teleop-tele1.jpg',
          w: 720, h: 1280, duration: 69,
          caption: '<b>Arm teleoperation.</b> The operator’s arm motion, tracked by Apple Vision Pro, drives the semi-humanoid in the background.',
        },
        {
          kind: 'loop',
          label: 'Hand retargeting',
          src: 'assets/videos_web/teleop-tele2.mp4',
          poster: 'assets/posters/teleop-tele2.jpg',
          w: 720, h: 1280, duration: 29,
          caption: '<b>Hand retargeting.</b> The underactuated dexterous hand mirrors the operator’s finger gestures in real time.',
        },
        {
          kind: 'loop',
          label: 'Camera stream',
          src: 'assets/videos_web/teleop-tele3.mp4',
          poster: 'assets/posters/teleop-tele3.jpg',
          w: 720, h: 1280, duration: 7,
          caption: '<b>Head-camera stream.</b> The robot’s view streamed to the operator over WebRTC (laptop view).',   // TODO: confirm
        },
      ],
    },
  },
];
