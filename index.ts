
async function bootstrap() {
    try {
        console.log("");
    } catch (error) {
        console.log(error);
    }
}

bootstrap().catch(err => {
    console.log(err);
    process.exit(1);
})

