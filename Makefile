reset:
	make down up

up:
	docker-compose up --build --detach api web

down:
	docker-compose down --remove-orphans
