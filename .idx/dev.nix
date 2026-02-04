# Firebase Studio workspace configuration
{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_22
    pkgs.jdk21
  ];

  idx = {
    extensions = [];

    previews = {
      enable = true;
      previews = {
        web = {
          command = [
            "npm" "run" "serve"
          ];
          manager = "web";
          env = {
            PORT = "$PORT";
          };
        };
      };
    };

    workspace = {
      onCreate = {
        npm-install = "npm install && npm install --prefix functions";
        build = "npm run build";
      };
    };
  };
}
