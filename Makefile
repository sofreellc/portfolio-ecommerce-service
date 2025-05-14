export DOCKER_HOST=unix://$(HOME)/.local/share/containers/podman/machine/podman-default/podman.sock

reset:
	make down up

up:
	podman-compose up --build --detach api

down:
	podman-compose down --remove-orphans
