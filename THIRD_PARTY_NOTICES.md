# Third-party notices

The MIT license in this repository covers original RealReveal source code, documentation and procedurally generated fixtures in `samples/images/`. It does not relicense third-party dependencies, external datasets or pretrained weights.

- React, Vite, Tailwind CSS, Framer Motion and Lucide are used by the frontend. Their notices are available in the corresponding installed packages and package metadata.
- Flask, Flask-CORS, NumPy, Pillow, TensorFlow, Keras, python-dotenv and Gunicorn are backend dependencies. Preserve their distributed licenses when redistributing packages.
- The inference network uses the Keras EfficientNetB0 architecture and was initialized from ImageNet weights according to the available project notebook. Consult the relevant upstream terms for redistributed pretrained assets.
- `backend/best_subset_model.h5` is the existing project-trained checkpoint. The original dataset's source URL and license were not recorded in the available project materials. The source-code MIT license does not establish distribution rights for third-party training assets. Resolve dataset and weight provenance before representing this artifact as fully open data or an unrestricted model release.
- The original `backend/testing images/` images have unknown provenance and are excluded from the prepared submission archive. The supplied generated fixtures contain no people and carry no real/fake ground-truth labels.
- Optional IBM Watsonx access is a separate service requiring the user's own account and terms. It is not needed for the default local application.
