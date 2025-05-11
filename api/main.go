package main

import (
	"fmt"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		c.String(200, "Hello World")
	})

	err := r.Run(":8080")
	if err != nil {
		fmt.Printf("Error starting service %v", err)
		return
	}
}
